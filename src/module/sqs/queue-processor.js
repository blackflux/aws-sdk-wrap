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

  return wrap((event) => {
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
        Joi.array().items(step.next.map((n) => steps[n].schema)),
        `Unexpected/Invalid next step(s) returned for: ${payload.name}`
      );
      await sendMessageBatch(messages, queueUrl);
      return payload;
    }));
  });
};
