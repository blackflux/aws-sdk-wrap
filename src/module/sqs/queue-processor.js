const assert = require('assert');
const fs = require('smart-fs');
const path = require('path');
const Joi = require('joi-strict');
const { wrap } = require('lambda-async');
const { prepareMessage } = require('./prepare-message');

module.exports = ({ sendMessageBatch }) => (opts) => {
  Joi.assert(opts, Joi.object().keys({
    // queueUrls entries are undefined when QueueProcessor is instantiated.
    queueUrls: Joi.array().sparse(),
    stepsDir: Joi.string(),
    ingestSteps: Joi.array().unique().min(1).items(Joi.string())
  }));
  const { queueUrls, stepsDir, ingestSteps } = opts;
  const steps = fs
    .readdirSync(stepsDir)
    .reduce((p, step) => Object.assign(p, {
      [step.slice(0, -3)]: (() => {
        const stepLogic = fs.smartRead(path.join(stepsDir, step));
        const {
          schema,
          handler,
          next,
          queueUrl,
          delay = 0,
          before = async (stepContext) => [],
          after = async (stepContext) => []
        } = stepLogic;
        assert(Joi.isSchema(schema) === true, 'Schema not a Joi schema.');
        assert(
          typeof handler === 'function' && handler.length === 3,
          'Handler must be a function taking three arguments.'
        );
        assert(
          Array.isArray(next) && next.every((e) => typeof e === 'string'),
          'Next must be an array of strings.'
        );
        assert(
          queueUrls.includes(queueUrl),
          'Step has invalid / not allowed queueUrl defined.'
        );
        assert(
          Number.isInteger(delay) && delay >= 0 && delay <= 15 * 60,
          'Invalid value for step delay provided.'
        );
        assert(
          typeof before === 'function' && before.length === 1,
          'Invalid before() definition for step.'
        );
        assert(
          typeof after === 'function' && after.length === 1,
          'Invalid after() definition for step.'
        );
        return {
          name: step.slice(0, -3),
          handler: (payload, ...args) => {
            Joi.assert(payload, schema, `Invalid payload received for step: ${payload.name}`);
            return handler(payload, ...args);
          },
          schema,
          next,
          queueUrl,
          delay,
          before,
          after,
          isParallel: typeof stepLogic.before === 'function' && typeof stepLogic.after === 'function'
        };
      })()
    }), {});
  assert(
    queueUrls.every((queueUrl) => Object.values(steps).some((step) => queueUrl === step.queueUrl)),
    'Unused entry in queueUrls defined.'
  );

  const sendMessages = async (messages) => {
    const batches = {};
    messages.forEach((msg) => {
      const queueUrl = steps[msg.name].queueUrl;
      assert(queueUrl !== undefined);
      const delay = steps[msg.name].delay;
      assert(delay !== undefined);
      if (delay !== 0) {
        prepareMessage(msg, { delaySeconds: steps[msg.name].delay });
      }
      if (batches[queueUrl] === undefined) {
        batches[queueUrl] = [];
      }
      batches[queueUrl].push(msg);
    });
    const batchEntries = Object.entries(batches);
    for (let i = 0; i < batchEntries.length; i += 1) {
      const [queueUrl, msgs] = batchEntries[i];
      // eslint-disable-next-line no-await-in-loop
      await sendMessageBatch({ queueUrl, messages: msgs });
    }
  };

  const ingestSchema = Joi.array().items(...ingestSteps.map((step) => steps[step].schema));
  const ingest = async (messages) => {
    Joi.assert(messages, ingestSchema);
    await sendMessages(messages);
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
        return [payload, e, step];
      });

    if (event.Records.length !== 1) {
      const invalidSteps = Array.from(stepContexts)
        .filter(([step]) => !step.isParallel)
        .map(([step]) => step.name);
      if (invalidSteps.length !== 0) {
        throw new Error(`SQS mis-configured. Parallel processing not supported for: ${invalidSteps.join(', ')}`);
      }
    }

    const messageBus = (() => {
      const messages = [];
      return {
        add: (msgs, step) => {
          assert(
            msgs.length === 0 || step.next.length !== 0,
            `No output allowed for step: ${step.name}`
          );
          Joi.assert(
            msgs,
            Joi.array().items(...step.next.map((n) => steps[n].schema)),
            `Unexpected/Invalid next step(s) returned for: ${step.name}`
          );
          messages.push(...msgs);
        },
        send: async () => {
          const toSend = messages.splice(0);
          await sendMessages(toSend);
          return toSend;
        }
      };
    })();

    await Promise.all(Array.from(stepContexts)
      .map(([step, ctx]) => step.before(ctx).then((msgs) => messageBus.add(msgs, step))));

    await Promise.all(tasks.map(async ([payload, e, step]) => {
      messageBus.add(await step.handler(payload, e, stepContexts.get(step)), step);
    }));

    await Promise.all(Array.from(stepContexts)
      .map(([step, ctx]) => step.after(ctx).then((msgs) => messageBus.add(msgs, step))));

    return messageBus.send();
  });

  const digraph = () => {
    const formatStep = (step) => step.replace(/-([a-z])/g, ($1) => $1.slice(1).toUpperCase());
    const shortenQueueUrl = (queueUrl) => queueUrl
      .slice([...queueUrl].findIndex((e, idx) => queueUrls.some((qUrl) => qUrl[idx] !== e)));

    const result = [
      ...queueUrls
        .map((queueUrl, idx) => [
          `subgraph cluster_${idx} {`,
          ...[
            `label="${shortenQueueUrl(queueUrl)}";`,
            'style=filled;',
            'color=lightgrey;',
            'node [style=filled,color=white];',
            ...Object
              .values(steps)
              .filter((step) => queueUrl === step.queueUrl)
              .map((step) => `${formatStep(step.name)} [${[
                step.isParallel ? 'color=red' : null,
                step.delay !== 0 ? 'shape=doublecircle' : null
              ].filter((e) => e !== null).join(',')}];`)
          ].map((e) => `  ${e}`),
          '}'
        ])
        .reduce((p, c) => p.concat(c), []),
      '',
      'ingest [shape=Mdiamond];',
      ...ingestSteps.map((step) => `ingest -> ${formatStep(step)};`),
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

  return { ingest, handler, digraph };
};
