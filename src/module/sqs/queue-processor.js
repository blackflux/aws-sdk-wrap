const assert = require('assert');
const fs = require('smart-fs');
const path = require('path');
const Joi = require('joi-strict');
const { wrap } = require('lambda-async');

module.exports = ({ sendMessageBatch }) => ({ queueUrl, stepsDir }) => {
  const steps = fs
    .readdirSync(stepsDir)
    .reduce((p, step) => Object.assign(p, {
      [step.slice(0, -3)]: (() => {
        const { schema, handler, next } = fs.smartRead(path.join(stepsDir, step));
        assert(Joi.isSchema(schema) === true, 'Schema not a Joi schema.');
        assert(
          typeof handler === 'function' && handler.length === 2,
          'Handler must be a function taking two arguments.'
        );
        assert(
          Array.isArray(next) && next.every((e) => typeof e === 'string'),
          'Next must be an array of strings.'
        );
        return {
          handler: (payload, event) => {
            Joi.assert(payload, schema, `Invalid payload received for step: ${payload.name}`);
            return handler(payload, event);
          },
          schema,
          next
        };
      })()
    }), {});
  const globalSchema = Joi.array().items(...Object.values(steps).map((step) => step.schema));
  const ingest = async (messages) => {
    Joi.assert(messages, globalSchema);
    await sendMessageBatch(messages, queueUrl);
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
      await ingest(messages);
      return payload;
    }));
  });

  return { ingest, handler };
};
