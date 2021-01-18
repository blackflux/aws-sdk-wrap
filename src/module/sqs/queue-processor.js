const assert = require('assert');
const Joi = require('joi-strict');
const get = require('lodash.get');
const { Pool } = require('promise-pool-ext');
const LRU = require('lru-cache-ext');
const { wrap } = require('lambda-async');
const { prepareMessage } = require('./prepare-message');
const errors = require('./errors');
const loadSteps = require('./queue-processor/load-steps');

const metaKey = '__meta';
const stripPayloadMeta = (payload) => {
  const r = { ...payload };
  delete r[metaKey];
  return r;
};

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

  const messageBus = (() => {
    const tasks = [];
    const addRaw = (msgs, queueUrl) => {
      tasks.push([msgs, queueUrl]);
    };
    return {
      addRaw,
      addStepMessages: (messages) => {
        messages.forEach((msg) => {
          const queueUrl = queues[steps[msg.name].queue];
          assert(queueUrl !== undefined);
          const groupIdFunction = steps[msg.name].groupIdFunction;
          if (groupIdFunction !== null) {
            prepareMessage(msg, {
              groupId: groupIdFunction(msg)
            });
          }
          const delay = steps[msg.name].delay;
          assert(delay !== undefined);
          if (delay !== 0) {
            prepareMessage(msg, { delaySeconds: steps[msg.name].delay });
          }
          addRaw([msg], queueUrl);
        });
      },
      flush: async (full = true) => {
        if (tasks.length === 0) {
          return;
        }
        const groups = {};
        tasks.splice(0).forEach(([msgs, queueUrl]) => {
          if (groups[queueUrl] === undefined) {
            groups[queueUrl] = [];
          }
          groups[queueUrl].push(...msgs);
        });
        const fns = Object.entries(groups)
          .map(([queueUrl, messages]) => () => sendMessageBatch({ queueUrl, messages }));
        await globalPool(fns);
      }
    };
  })();

  const ingestSchema = Joi.array().items(...ingestSteps.map((step) => steps[step].schema));
  const ingest = async (messages) => {
    Joi.assert(messages, ingestSchema);
    messageBus.addStepMessages(messages);
    await messageBus.flush();
  };

  const handler = wrap(async (event) => {
    const stepContexts = new Map();
    const tasks = event.Records
      .map((e) => {
        const payload = JSON.parse(e.body);
        assert(
          payload instanceof Object && !Array.isArray(payload),
          `Invalid Event Received: ${e.body}`
        );
        assert(
          payload.name !== undefined,
          'Received step event that is missing "name" property.'
        );
        const step = steps[payload.name];
        assert(
          step !== undefined,
          `Invalid step provided: ${payload.name}`
        );
        if (!stepContexts.has(step)) {
          stepContexts.set(step, Object.create(null));
        }
        return [payload, stripPayloadMeta(payload), e, step];
      });

    if (event.Records.length !== 1) {
      const invalidSteps = Array.from(stepContexts)
        .filter(([step]) => !step.isParallel)
        .map(([step]) => step.name);
      if (invalidSteps.length !== 0) {
        throw new Error(`SQS mis-configured. Parallel processing not supported for: ${invalidSteps.join(', ')}`);
      }
    }

    const stepBus = (() => {
      const messages = [];
      return {
        prepare: (msgs, step) => {
          assert(
            msgs.length === 0 || step.next.length !== 0,
            `No output allowed for step: ${step.name}`
          );
          Joi.assert(
            msgs.map((payload) => stripPayloadMeta(payload)),
            Joi.array().items(...step.next.map((n) => steps[n].schema)),
            `Unexpected/Invalid next step(s) returned for: ${step.name}`
          );
          messages.push(...msgs);
        },
        propagate: () => {
          const msgs = messages.splice(0);
          messageBus.addStepMessages(msgs);
          return msgs;
        }
      };
    })();

    const dlqBus = (() => {
      const pending = [];
      return {
        prepare: (msgs, step) => {
          pending.push([step, msgs]);
        },
        propagate: async () => {
          if (pending.length === 0) {
            return;
          }
          const fns = pending.splice(0).map(([step, msgs]) => async () => {
            const queueUrl = queues[step.queue];
            const dlqUrl = await dlqCache.memoize(
              queueUrl,
              () => getDeadLetterQueueUrl(queueUrl)
            );
            messageBus.addRaw(msgs, dlqUrl);
          });
          await globalPool(fns);
        }
      };
    })();

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

  const digraph = () => {
    const formatStep = (step) => step.replace(/-([a-z])/g, ($1) => $1.slice(1).toUpperCase());

    const result = [
      ...Object.keys(queues)
        .map((queue, idx) => [
          `subgraph cluster_${idx} {`,
          ...[
            `label="${queue}";`,
            'style=filled;',
            'color=lightgrey;',
            'node [label="node",style=filled,color=white];',
            ...Object
              .values(steps)
              .filter((step) => queue === step.queue)
              .map((step) => `${formatStep(step.name)} [${[
                `label="${step.name}"`,
                step.isParallel ? 'color=red' : null,
                step.delay !== 0 ? 'shape=doublecircle' : null
              ].filter((e) => e !== null).join(',')}];`)
          ].map((e) => `  ${e}`),
          '}'
        ])
        .reduce((p, c) => p.concat(c), []),
      '',
      '_ingest [shape=Mdiamond,label=ingest];',
      ...ingestSteps.map((step) => `_ingest -> ${formatStep(step)};`),
      '',
      ...Object.values(steps).reduce((r, step) => {
        step.next.forEach((nStep) => {
          r.push(`${formatStep(step.name)} -> ${formatStep(nStep)};`);
        });
        return r;
      }, [])
    ];

    return [
      '# Visualize at http://viz-js.com/',
      'digraph G {',
      ...result.map((e) => `  ${e}`),
      '}'
    ];
  };

  return {
    ingest,
    handler,
    digraph
  };
};
