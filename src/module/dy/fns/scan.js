const assert = require('assert');

module.exports = (model, validateSecondaryIndex, setDefaults) => async ({
  index = null,
  limit = 20,
  consistent = true,
  toReturn = null,
  lastEvaluatedKey = null
} = {}) => {
  assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
  if (index !== null) {
    validateSecondaryIndex(index);
  }
  const result = await model.entity.scan({
    ...(index === null ? {} : { index }),
    limit,
    consistent,
    ...(toReturn === null ? {} : { attributes: toReturn }),
    ...(lastEvaluatedKey === null ? {} : { startKey: lastEvaluatedKey })
  });
  return {
    items: result.Items.map((item) => setDefaults(item, toReturn)),
    ...(result.LastEvaluatedKey === undefined ? {} : { lastEvaluatedKey: result.LastEvaluatedKey })
  };
};
