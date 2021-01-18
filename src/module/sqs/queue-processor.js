const assert = require('assert');
const Joi = require('joi-strict');
const get = require('lodash.get');
const { Pool } = require('promise-pool-ext');
const LRU = require('lru-cache-ext');
const { wrap } = require('lambda-async');
const { prepareMessage } = require('./prepare-message');
const errors = require('./errors');
const loadSteps = require('./queue-processor/load-steps');
const MessageBus = require('./queue-processor/message-bus');
const StepBus = require('./queue-processor/step-bus');
const DlqBus = require('./queue-processor/dlq-bus');
const { metaKey } = require('./queue-processor/payload');
const Digraph = require('./queue-processor/digraph');
const processEvent = require('./queue-processor/process-event');

module.exports = ({
  sendMessageBatch,
  getDeadLetterQueueUrl,
  logger
}) => (opts) => {
  const dlqCache = new LRU({ maxAge: 60 * 1000 });
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
    sendMessageBatch,
    queues,
    steps,
    globalPool
  });

  const ingestSchema = Joi.array().items(...ingestSteps.map((step) => steps[step].schema));
  const ingest = async (messages) => {
    Joi.assert(messages, ingestSchema);
    messageBus.addStepMessages(messages);
    await messageBus.flush();
  };

  const handler = wrap(async (event) => {
    const { tasks, stepContexts } = processEvent({ event, steps });

    const stepBus = StepBus({ steps, messageBus });
    const dlqBus = DlqBus({
      queues, dlqCache, getDeadLetterQueueUrl, messageBus, globalPool
    });

    await Promise.all(Array.from(stepContexts)
      .map(([step, ctx]) => step.before(
        ctx,
        tasks.filter((e) => e[3] === step).map((e) => e[1])
      ).then((msgs) => stepBus.prepare(msgs, step))));

    await Promise.all(tasks.map(async ([payload, payloadStripped, e, step]) => {
      try {
        const msgs = await step.pool(() => step.handler(payloadStripped, e, stepContexts.get(step)));
        stepBus.prepare(msgs, step);
      } catch (error) {
        let err = error;
        if (!(err instanceof errors.RetryError)) {
          if (step.retry === null) {
            throw err;
          } else {
            err = step.retry;
          }
        }
        const maxFailureCount = err.maxFailureCount;
        const maxAgeInSec = err.maxAgeInSec;
        const backoffInSec = err.backoffInSec;
        const failureCount = get(payload, [metaKey, 'failureCount'], 0) + 1;
        const timestamp = get(
          payload,
          [metaKey, 'timestamp'],
          new Date(
            Number.parseInt(get(e, ['attributes', 'SentTimestamp'], Date.now()), 10)
          ).toISOString()
        );
        const kwargs = {
          logger,
          limits: {
            maxFailureCount,
            maxAgeInSec
          },
          meta: {
            failureCount,
            timestamp
          },
          payload: payloadStripped,
          error
        };
        const delaySeconds = typeof backoffInSec === 'function'
          ? backoffInSec(kwargs.meta)
          : backoffInSec;
        if (
          failureCount >= maxFailureCount
          || (Date.now() - Date.parse(timestamp)) / 1000 > maxAgeInSec
        ) {
          const msgs = await err.onFailure({ ...kwargs, temporary: false });
          assert(Array.isArray(msgs), 'onFailure must return array of messages');
          stepBus.prepare(msgs, step);
          dlqBus.prepare([payload], step);
        } else {
          const msgs = await err.onFailure({ ...kwargs, temporary: true });
          assert(Array.isArray(msgs), 'onFailure must return array of messages');
          const msg = {
            ...payload,
            [metaKey]: {
              failureCount,
              timestamp
            }
          };
          if (delaySeconds !== 0) {
            prepareMessage(msg, { delaySeconds });
          }
          stepBus.prepare(msgs.concat(msg), step);
        }
      }
    }));

    await Promise.all(Array.from(stepContexts)
      .map(([step, ctx]) => step.after(ctx).then((msgs) => stepBus.prepare(msgs, step))));

    const result = stepBus.propagate();
    await dlqBus.propagate();
    await messageBus.flush();
    return result;
  });

  return {
    ingest,
    handler,
    digraph: Digraph({ queues, ingestSteps, steps })
  };
};
