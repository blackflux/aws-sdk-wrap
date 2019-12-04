const assert = require('assert');
const fs = require('smart-fs');
const path = require('path');
const Joi = require('joi-strict');
const { wrap } = require('lambda-async');

module.exports = ({ sendMessageBatch }) => (opts) => {
  Joi.assert(opts, Joi.object().keys({
    queueUrls: Joi.array().items(Joi.string()),
    stepsDir: Joi.string(),
    ingestSteps: Joi.array().unique().min(1).items(Joi.string())
  }));
  const { queueUrls, stepsDir, ingestSteps } = opts;
  const steps = fs
    .readdirSync(stepsDir)
    .reduce((p, step) => Object.assign(p, {
      [step.slice(0, -3)]: (() => {
        const {
          schema, handler, next, queueUrl
        } = fs.smartRead(path.join(stepsDir, step));
        assert(Joi.isSchema(schema) === true, 'Schema not a Joi schema.');
        assert(
          typeof handler === 'function' && handler.length === 2,
          'Handler must be a function taking two arguments.'
        );
        assert(
          Array.isArray(next) && next.every((e) => typeof e === 'string'),
          'Next must be an array of strings.'
        );
        assert(
          queueUrls.includes(queueUrl),
          'Step has invalid / not allowed queueUrl defined.'
        );
        return {
          handler: (payload, event) => {
            Joi.assert(payload, schema, `Invalid payload received for step: ${payload.name}`);
            return handler(payload, event);
          },
          schema,
          next,
          queueUrl
        };
      })()
    }), {});
  assert(
    queueUrls.every((queueUrl) => Object.values(steps).some((step) => queueUrl === step.queueUrl)),
    'Unused entry in queueUrls defined'
  );

  const sendMessages = async (messages) => {
    const batches = {};
    messages.forEach((msg) => {
      const queueUrl = steps[msg.name].queueUrl;
      assert(queueUrl !== undefined);
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

  const handler = wrap((event) => {
    assert(
      event.Records.length === 1,
      'Lambda SQS subscription is mis-configured! '
      + 'Please only process one event at a time for retry resilience.'
    );
    return Promise.all(event.Records.map(async (e) => {
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
      const messages = await step.handler(payload, e);
      assert(
        messages.length === 0 || step.next.length !== 0,
        `No output allowed for step: ${payload.name}`
      );
      Joi.assert(
        messages,
        Joi.array().items(...step.next.map((n) => steps[n].schema)),
        `Unexpected/Invalid next step(s) returned for: ${payload.name}`
      );
      await sendMessages(messages);
      return payload;
    }));
  });

  return { ingest, handler };
};
