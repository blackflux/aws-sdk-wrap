const assert = require('assert');
const { stripPayloadMeta } = require('./payload');

module.exports = ({ event, steps }) => {
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

  return { tasks, stepContexts };
};
