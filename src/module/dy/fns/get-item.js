import assert from 'assert';
import isEqual from 'lodash.isequal';
import Joi from 'joi-strict';

export default (model, onNotFound_, setDefaults) => async (...args) => {
  Joi.assert(args, Joi.array().ordered(
    Joi.object(),
    Joi.object().keys({
      // eslint-disable-next-line newline-per-chained-call
      toReturn: Joi.array().items(Joi.string()).unique().min(1).optional(),
      onNotFound: Joi.function().minArity(1).maxArity(2).optional()
    })
  ));
  const [key, {
    toReturn = null,
    onNotFound = onNotFound_
  } = {}] = args;
  assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
  assert(typeof onNotFound === 'function', onNotFound.length === 1);
  const result = await model.entity.get(key, {
    consistent: true,
    ...(toReturn === null
      ? {}
      : { attributes: [...new Set([...toReturn, ...Object.keys(key)])] })
  });
  if (result.Item === undefined) {
    return onNotFound(key, { error: 'item_not_found' });
  }
  const item = setDefaults(result.Item, toReturn);
  if (Object.entries(key).some(([k, v]) => !isEqual(item[k], v))) {
    return onNotFound(key, { error: 'item_attribute_mismatch' });
  }
  Object
    .keys(item)
    .filter((k) => toReturn !== null && !toReturn.includes(k))
    .forEach((k) => {
      delete item[k];
    });
  return item;
};
