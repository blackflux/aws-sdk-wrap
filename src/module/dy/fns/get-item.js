const assert = require('assert');

module.exports = (model, onNotFound_, setDefaults) => async (key, {
  toReturn = null,
  onNotFound = onNotFound_
} = {}) => {
  assert(toReturn === null || toReturn.length === new Set(toReturn).size);
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
