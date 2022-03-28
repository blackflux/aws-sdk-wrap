import assert from 'assert';
import { stripPayloadMeta } from './payload.js';

export default ({ event, steps }) => {
  const stepContexts = {};
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
      if (!(step.name in stepContexts)) {
        stepContexts[step.name] = [step, {}];
      }
      return [payload, stripPayloadMeta(payload), e, step];
    });

  if (event.Records.length !== 1) {
    const invalidSteps = Object.entries(stepContexts)
      .filter(([k, [step]]) => !step.isParallel)
      .map(([k]) => k);
    if (invalidSteps.length !== 0) {
      throw new Error(`SQS mis-configured. Parallel processing not supported for: ${invalidSteps.join(', ')}`);
    }
  }

  return { tasks, stepContexts };
};
