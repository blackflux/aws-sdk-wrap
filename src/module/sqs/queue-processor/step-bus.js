import assert from 'assert';
import Joi from 'joi-strict';
import updateTrace from './update-trace.js';
import { stripPayloadMeta } from './payload.js';

export default ({ steps, messageBus }) => {
  const messages = [];
  return {
    push: (msgs_, step, trace) => {
      const msgs = updateTrace(msgs_, step, trace);
      assert(
        msgs.length === 0 || step.next.length !== 0,
        `No output allowed for step: ${step.name}`
      );
      Joi.assert(
        msgs.map((payload) => stripPayloadMeta(payload)),
        Joi.array().items(...step.next.map((n) => steps[n].schema)),
        `Unexpected/Invalid next step(s) returned for: ${step.name}`
      );
      messageBus.addStepMessages(msgs);
      messages.push(...msgs);
    },
    get: () => messages
  };
};
