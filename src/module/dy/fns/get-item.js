import assert from 'assert';
import Joi from 'joi-strict';

export default (model, onNotFound_, setDefaults) => async (...args) => {
  Joi.assert(args, Joi.array().ordered(
    Joi.object(),
    Joi.object().keys({
      // eslint-disable-next-line newline-per-chained-call
      toReturn: Joi.array().items(Joi.string()).unique().min(1).optional(),
      onNotFound: Joi.function().arity(1).optional()
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
    ...(toReturn === null ? {} : { attributes: toReturn })
  });
  if (result.Item === undefined) {
    return onNotFound(key);
  }
  return setDefaults(result.Item, toReturn);
};
