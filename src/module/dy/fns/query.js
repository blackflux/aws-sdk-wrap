const assert = require('assert');
const Joi = require('joi-strict');
const { fromCursor, buildPageObject } = require('../../../util/paging');

module.exports = (model, setDefaults, getSortKeyByIndex) => {
  const conditionsSchema = Joi.object({
    attr: Joi.string()
  }).pattern(
    Joi.string().valid('eq', 'lt', 'lte', 'gt', 'gte', 'between', 'beginsWith'),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array().items(
        Joi.string(),
        Joi.number(),
        Joi.boolean()
      ).length(2)
    )
  ).length(2);
  const queryItems = async ({
    partitionKey,
    index,
    queryLimit,
    consistent,
    scanIndexForward,
    conditions,
    filters,
    toReturn,
    lastEvaluatedKey: previousLastEvaluatedKey
  }) => {
    const items = [];
    let lastEvaluatedKey = previousLastEvaluatedKey;
    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await model.entity.query(partitionKey, {
        ...(index === null ? {} : { index }),
        ...(queryLimit === null ? {} : { limit: queryLimit - items.length }),
        consistent,
        reverse: scanIndexForward === false,
        ...(conditions === null ? {} : Object.entries(conditions)
          .filter(([k, _]) => k !== 'attr')
          .reduce((prev, [k, v]) => {
            // eslint-disable-next-line no-param-reassign
            prev[k] = v;
            return prev;
          }, {})),
        ...(filters === null ? {} : { filters }),
        ...(toReturn === null ? {} : { attributes: toReturn }),
        ...(lastEvaluatedKey === null ? {} : { startKey: lastEvaluatedKey })
      });
      items.push(...result.Items);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey !== undefined && (queryLimit === null || items.length < queryLimit));
    return { items, lastEvaluatedKey };
  };

  return async (partitionKey, {
    index = null,
    limit = 20,
    consistent = true,
    conditions = null,
    filters = null,
    toReturn = null,
    cursor
  } = {}) => {
    if (index !== null) {
      const secondaryIndex = model.schema.GlobalSecondaryIndexes.find(({ IndexName }) => IndexName === index);
      if (secondaryIndex === undefined) {
        throw new Error(`Invalid index provided: ${index}`);
      }
    }
    if (conditions !== null) {
      Joi.assert(conditions, conditionsSchema, 'Invalid conditions provided');
      const attr = getSortKeyByIndex(index);
      assert(attr === conditions.attr, `Expected conditions.attr to be "${attr}"`);
    }
    const {
      limit: queryLimit = limit,
      scanIndexForward = true,
      lastEvaluatedKey = null,
      currentPage = null
    } = fromCursor(cursor);
    const result = await queryItems({
      partitionKey,
      index,
      queryLimit,
      consistent,
      scanIndexForward,
      conditions,
      filters,
      toReturn,
      lastEvaluatedKey
    });
    const page = buildPageObject({
      currentPage: currentPage === null ? 1 : currentPage,
      limit: queryLimit,
      lastEvaluatedKey: result.lastEvaluatedKey === undefined ? null : result.lastEvaluatedKey
    });
    return {
      items: result.items.map((item) => setDefaults(item, toReturn)),
      page
    };
  };
};
