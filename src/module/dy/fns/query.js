const assert = require('assert');
const Joi = require('joi-strict');
const { fromCursor, buildPageObject } = require('../../../util/paging');

module.exports = (model, validateSecondaryIndex, setDefaults, getSortKeyByIndex) => {
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
    assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
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

  return async (...args) => {
    Joi.assert(args, Joi.array().ordered(
      Joi.string(),
      Joi.object().keys({
        index: Joi.string().allow(null).optional(),
        // eslint-disable-next-line newline-per-chained-call
        limit: Joi.number().integer().allow(null).min(1).optional(),
        consistent: Joi.boolean().optional(),
        conditions: Joi.alternatives(Joi.object(), Joi.array()).allow(null).optional(),
        filters: Joi.alternatives(Joi.object(), Joi.array()).allow(null).optional(),
        // eslint-disable-next-line newline-per-chained-call
        toReturn: Joi.array().items(Joi.string()).unique().min(1).optional(),
        cursor: Joi.string().optional()
      })
    ));
    const [partitionKey, {
      index = null,
      limit = 20,
      consistent = true,
      conditions = null,
      filters = null,
      toReturn = null,
      cursor
    } = {}] = args;
    if (index !== null) {
      validateSecondaryIndex(index);
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
