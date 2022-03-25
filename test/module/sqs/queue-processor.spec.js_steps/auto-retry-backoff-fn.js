import Joi from 'joi-strict';
import { RetryError } from '../../../../src/module/sqs/errors.js';

export const name = 'auto-retry-backoff-fn';

export const queue = 'one';

export const schema = Joi.object().keys({
  name: Joi.string().valid('auto-retry-backoff-fn')
});

export const handler = async (payload, event, context) => {
  throw new RetryError({
    backoffInSec: ({ failureCount }) => Math.min(failureCount * 10, 15 * 60)
  });
};

export const next = ['auto-retry-backoff-fn'];

export const delay = 0;
