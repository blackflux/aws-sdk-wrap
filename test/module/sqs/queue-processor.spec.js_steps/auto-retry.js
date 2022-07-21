import Joi from 'joi-strict';
import { RetryError } from '../../../../src/module/sqs/errors.js';

export const name = 'auto-retry';

export const queue = 'one';

export const ingest = false;

export const schema = Joi.object().keys({
  name: Joi.string().valid('auto-retry'),
  retrySettings: Joi.object().optional()
});

export const before = async (context, payloads) => [];
export const handler = async (payload, event, context) => {
  throw new RetryError(payload.retrySettings);
};
export const after = async (context) => [];

export const next = ['auto-retry'];

export const delay = 0;
