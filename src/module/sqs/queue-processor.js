import assert from 'assert';
import get from 'lodash.get';
import Joi from 'joi-strict';
import { Pool } from 'promise-pool-ext';
import { wrap } from 'lambda-async';
import { metaKey } from './queue-processor/payload.js';
import loadSteps from './queue-processor/load-steps.js';
import MessageBus from './queue-processor/message-bus.js';
import StepBus from './queue-processor/step-bus.js';
import DlqBus from './queue-processor/dlq-bus.js';
import Digraph from './queue-processor/digraph.js';
import processEvent from './queue-processor/process-event.js';
import handleError from './queue-processor/handle-error.js';

export default ({
  sendMessageBatch,
  getDeadLetterQueueUrl,
  logger
}) => (opts) => {
  const globalPool = Pool({ concurrency: Number.MAX_SAFE_INTEGER });

  Joi.assert(opts, Joi.object().keys({
    // queue urls can be undefined when QueueProcessor is instantiated.
    queues: Joi.object().pattern(Joi.string(), Joi.string().optional()),
    steps: Joi.array().items(Joi.object()),
    ingestSteps: Joi.array().unique().min(1).items(Joi.string())
  }));
  const {
    queues,
    steps: stepsRaw,
    ingestSteps
  } = opts;
  const steps = loadSteps(stepsRaw, queues);
  assert(
    Object.keys(queues).every((queue) => Object.values(steps).some((step) => queue === step.queue)),
    'Unused queue(s) defined.'
  );

  const messageBus = MessageBus({
    sendMessageBatch, queues, steps, globalPool
  });

  const ingestSchema = Joi.array().items(...ingestSteps.map((step) => steps[step].schema));
  const ingest = async (messages) => {
    Joi.assert(messages, ingestSchema);
    messageBus.addStepMessages(messages);
    await messageBus.flush(true);
  };

  const handler = (queue) => {
    if (queue !== null && !(queue in queues)) {
      throw new Error(`Unknown queue "${queue}" for handler provided`);
    }
    return wrap(async (event) => {
      const { tasks, stepContexts } = processEvent({ event, steps });
      if (queue !== null && !tasks.every((e) => e[3].queue === queue)) {
        throw new Error(
          `Bad step "${tasks.find((e) => e[3].queue !== queue)[3].name}" for handler "${queue}" provided`
        );
      }

      const stepBus = StepBus({ steps, messageBus });
      const dlqBus = DlqBus({
        queues, getDeadLetterQueueUrl, messageBus, globalPool
      });

      await Promise.all(Object.values(stepContexts)
        .map(([step, ctx]) => step.before(
          ctx,
          tasks.filter((e) => e[3] === step).map((e) => e[1])
        ).then((msgs) => stepBus.push(msgs, step, 'before()'))));

      await messageBus.flush(false);

      const result = {
        // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
        batchItemFailures: []
      };
      await Promise.all(tasks.map(async ([payload, payloadStripped, e, step]) => {
        try {
          const msgs = await step.pool(() => step.handler(payloadStripped, e, stepContexts[step.name][1]));
          stepBus.push(msgs, step, get(payload, [metaKey, 'trace'], []));
        } catch (error) {
          const handled = await handleError({
            error, payload, payloadStripped, e, step, stepBus, dlqBus, logger
          });
          if (handled === false) {
            result.batchItemFailures.push({
              itemIdentifier: e.messageId
            });
          }
        }
      }));

      await messageBus.flush(false);

      await Promise.all(Object.values(stepContexts)
        .map(([step, ctx]) => step.after(ctx).then((msgs) => stepBus.push(msgs, step, 'after()'))));

      await dlqBus.propagate();
      await messageBus.flush(true);
      // eslint-disable-next-line no-underscore-dangle
      result.__next = stepBus.get();
      return result;
    });
  };

  return {
    ingest,
    handler,
    digraph: Digraph({ queues, ingestSteps, steps })
  };
};
