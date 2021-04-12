const assert = require('assert');
const Joi = require('joi-strict');

module.exports = (model, validateSecondaryIndex, setDefaults) => async (...args) => {
  Joi.assert(args, Joi.array().ordered(Joi.object().keys({
    index: Joi.string().allow(null).optional(),
    limit: Joi.number().integer().min(1).optional(),
    consistent: Joi.boolean().optional(),
    filters: Joi.alternatives(Joi.object(), Joi.array()).allow(null).optional(),
    // eslint-disable-next-line newline-per-chained-call
    toReturn: Joi.array().items(Joi.string()).unique().min(1).optional(),
    lastEvaluatedKey: Joi.object().allow(null).optional()
  })));
  const [{
    index = null,
    limit = 20,
    consistent = true,
    filters = null,
    toReturn = null,
    lastEvaluatedKey = null
  } = {}] = args;
  assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
  if (index !== null) {
    validateSecondaryIndex(index);
  }
  const result = await model.entity.scan({
    ...(index === null ? {} : { index }),
    limit,
    consistent,
    ...(filters === null ? {} : { filters }),
    ...(toReturn === null ? {} : { attributes: toReturn }),
    ...(lastEvaluatedKey === null ? {} : { startKey: lastEvaluatedKey })
  });
  return {
    items: result.Items.map((item) => setDefaults(item, toReturn)),
    ...(result.LastEvaluatedKey === undefined ? {} : { lastEvaluatedKey: result.LastEvaluatedKey })
  };
};
