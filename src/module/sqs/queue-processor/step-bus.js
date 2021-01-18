const assert = require('assert');
const Joi = require('joi-strict');
const { stripPayloadMeta } = require('./payload');

module.exports = ({ steps, messageBus }) => {
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
};
