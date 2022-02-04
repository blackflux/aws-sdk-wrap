const assert = require('assert');
const Joi = require('joi-strict');
const { Pool } = require('promise-pool-ext');
const errors = require('../errors');

module.exports = (steps, queues) => steps
  .reduce((p, logic) => Object.assign(p, {
    [logic.name]: (() => {
      const {
        name,
        schema,
        handler,
        next,
        queue,
        delay = 0,
        retry = null,
        timeout = 900,
        groupIdFunction = null,
        deduplicationIdFunction = null,
        before = async (stepContext, payloads) => [],
        after = async (stepContext) => []
      } = logic;
      assert(typeof name === 'string', 'Step name must be a string.');
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
        Object.keys(queues).includes(queue),
        'Step has invalid / not allowed queue defined.'
      );
      assert(
        Number.isInteger(delay) && delay >= 0 && delay <= 15 * 60,
        'Invalid value for step delay provided.'
      );
      assert(
        retry === null || (retry instanceof Object && !Array.isArray(retry)),
        'Invalid value for step retry provided.'
      );
      assert(
        retry === null || next.includes(name),
        'Step with retry defined must include itself in "next".'
      );
      assert(
        Number.isInteger(timeout) && timeout > 0 && timeout <= 900,
        'Invalid value for step timeout provided.'
      );
      assert(
        groupIdFunction === null
        || (typeof groupIdFunction === 'function' && groupIdFunction.length === 1),
        'groupIdFunction must be a function taking one argument.'
      );
      assert(
        deduplicationIdFunction === null
        || (typeof deduplicationIdFunction === 'function' && deduplicationIdFunction.length === 1),
        'deduplicationIdFunction must be a function taking one argument.'
      );
      assert(
        typeof before === 'function' && before.length === 2,
        'Invalid before() definition for step.'
      );
      assert(
        typeof after === 'function' && after.length === 1,
        'Invalid after() definition for step.'
      );
      assert(
        retry === null || next.includes(name),
        'Step name must be present in "next" when "retry" defined.'
      );
      return {
        name,
        handler: (payload, ...args) => {
          Joi.assert(payload, schema, `Invalid payload received for step: ${payload.name}`);
          return handler(payload, ...args);
        },
        schema,
        next,
        queue,
        delay,
        retry: retry !== null ? new errors.RetryError(retry) : retry,
        pool: Pool({
          concurrency: Number.MAX_SAFE_INTEGER,
          timeout: timeout * 1000
        }),
        groupIdFunction,
        deduplicationIdFunction,
        before,
        after,
        isParallel: typeof logic.before === 'function' && typeof logic.after === 'function'
      };
    })()
  }), {});
