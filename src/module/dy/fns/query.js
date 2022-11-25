import assert from 'assert';
import Joi from 'joi-strict';
import Paging from '../paging.js';

export default (model, validateSecondaryIndex, setDefaults, getSortKeyByIndex, cursorSecret) => {
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
  const { fromCursor, buildPageObject } = Paging(cursorSecret);
  const queryItems = async ({
    partitionKey,
    index,
    queryLimit,
    consistent,
    queryScanIndexForward,
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
        reverse: queryScanIndexForward === false,
        ...(conditions === null ? {} : Object.entries(conditions)
          .filter(([k, _]) => k !== 'attr')
          .reduce((prev, [k, v]) => {
            // eslint-disable-next-line no-param-reassign
            prev[k] = v;
            return prev;
          }, {})),
        ...(filters === null ? {} : { filters }),
        ...(toReturn === null ? {} : { attributes: toReturn }),
        ...(lastEvaluatedKey === null ? {} : { startKey: lastEvaluatedKey }),
        entity: model.table.name
      });
      items.push(...result.Items);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey !== undefined && (queryLimit === null || items.length < queryLimit));
    return { items, lastEvaluatedKey };
  };

  return async (...args) => {
    Joi.assert(args, Joi.array().ordered(
      Joi.alternatives().try(Joi.string(), Joi.number()),
      Joi.object().keys({
        index: Joi.string().optional(),
        // eslint-disable-next-line newline-per-chained-call
        limit: Joi.number().integer().allow(null).min(1).optional(),
        scanIndexForward: Joi.boolean().optional(),
        consistent: Joi.boolean().optional(),
        conditions: Joi.alternatives(Joi.object(), Joi.array()).optional(),
        filters: Joi.alternatives(Joi.object(), Joi.array()).optional(),
        // eslint-disable-next-line newline-per-chained-call
        toReturn: Joi.array().items(Joi.string()).unique().min(1).optional(),
        cursor: Joi.string().optional()
      })
    ));
    const [partitionKey, {
      index = null,
      limit = undefined,
      scanIndexForward = undefined,
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
      limit: queryLimit = 20,
      scanIndexForward: queryScanIndexForward = true,
      lastEvaluatedKey = null,
      currentPage = null
    } = {
      ...fromCursor(cursor),
      ...(limit === undefined ? {} : { limit }),
      ...(scanIndexForward === undefined ? {} : { scanIndexForward })
    };
    const result = await queryItems({
      partitionKey,
      index,
      queryLimit,
      consistent,
      queryScanIndexForward,
      conditions,
      filters,
      toReturn,
      lastEvaluatedKey
    });
    const page = buildPageObject({
      currentPage: currentPage === null ? 1 : currentPage,
      limit: queryLimit,
      scanIndexForward: queryScanIndexForward,
      lastEvaluatedKey: result.lastEvaluatedKey === undefined ? null : result.lastEvaluatedKey
    });
    return {
      items: result.items.map((item) => setDefaults(item, toReturn)),
      page
    };
  };
};
