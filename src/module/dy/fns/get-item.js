const assert = require('assert');
const Joi = require('joi-strict');

module.exports = (model, onNotFound_, setDefaults) => async (key, kwargs = {}) => {
  Joi.assert(key, Joi.object());
  Joi.assert(kwargs, Joi.object().keys({
    // eslint-disable-next-line newline-per-chained-call
    toReturn: Joi.array().items(Joi.string()).unique().min(1).allow(null).optional(),
    onNotFound: Joi.function().arity(1).optional()
  }));
  const {
    toReturn = null,
    onNotFound = onNotFound_
  } = kwargs;
  assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
  assert(typeof onNotFound === 'function', onNotFound.length === 1);
  const result = await model.entity.get(key, {
    consistent: true,
    ...(toReturn === null ? {} : { attributes: toReturn })
  });
  if (result.Item === undefined) {
    return onNotFound(key);
  }
  return setDefaults(result.Item, toReturn);
};
