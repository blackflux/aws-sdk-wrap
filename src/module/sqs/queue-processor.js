const assert = require('assert');
const get = require('lodash.get');
const Joi = require('joi-strict');
const { Pool } = require('promise-pool-ext');
const { wrap } = require('lambda-async');
const { metaKey } = require('./queue-processor/payload');
const loadSteps = require('./queue-processor/load-steps');
const MessageBus = require('./queue-processor/message-bus');
const StepBus = require('./queue-processor/step-bus');
const DlqBus = require('./queue-processor/dlq-bus');
const Digraph = require('./queue-processor/digraph');
const processEvent = require('./queue-processor/process-event');
const handleError = require('./queue-processor/handle-error');

module.exports = ({
  sendMessageBatch,
  getDeadLetterQueueUrl,
  logger
}) => (opts) => {
  const globalPool = Pool({ concurrency: Number.MAX_SAFE_INTEGER });

  Joi.assert(opts, Joi.object().keys({
    // queue urls can be undefined when QueueProcessor is instantiated.
    queues: Joi.object().pattern(Joi.string(), Joi.string().optional()),
    stepsDir: Joi.string(),
    ingestSteps: Joi.array().unique().min(1).items(Joi.string())
  }));
  const { queues, stepsDir, ingestSteps } = opts;
  const steps = loadSteps(stepsDir, queues);
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

      await Promise.all(tasks.map(async ([payload, payloadStripped, e, step]) => {
        try {
          const msgs = await step.pool(() => step.handler(payloadStripped, e, stepContexts[step.name][1]));
          stepBus.push(msgs, step, get(payload, [metaKey, 'trace'], []));
        } catch (error) {
          await handleError({
            error, payload, payloadStripped, e, step, stepBus, dlqBus, logger
          });
        }
      }));

      await messageBus.flush(false);

      await Promise.all(Object.values(stepContexts)
        .map(([step, ctx]) => step.after(ctx).then((msgs) => stepBus.push(msgs, step, 'after()'))));

      await dlqBus.propagate();
      await messageBus.flush(true);
      return stepBus.get();
    });
  };

  return {
    ingest,
    handler,
    digraph: Digraph({ queues, ingestSteps, steps })
  };
};
