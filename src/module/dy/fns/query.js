import assert from 'assert';
import Joi from 'joi-strict';
import { Retainer } from 'object-fields';
import Paging from '../../../util/paging.js';

const getKeySchemaAttributesNames = (keySchema) => keySchema.map(({ AttributeName }) => AttributeName);

export default (model, validateSecondaryIndex, setDefaults, getSortKeyByIndex, cursorSecret) => {
  const {
    KeySchema,
    GlobalSecondaryIndexes = []
  } = model.schema;
  const primaryKeySchemaAttributesNames = getKeySchemaAttributesNames(KeySchema);
  const secondaryKeySchemasAttributesNamesByIndex = Object.fromEntries(
    GlobalSecondaryIndexes.map((e) => [e.IndexName, getKeySchemaAttributesNames(e.KeySchema)])
  );
  // https://stackoverflow.com/questions/21730183/dynamodb-global-secondary-index-with-exclusive-start-key
  const getPaginationKeys = (index) => {
    const secondaryKeySchemaAttributesNames = index === null
      ? []
      : secondaryKeySchemasAttributesNamesByIndex[index];
    return [...new Set([...primaryKeySchemaAttributesNames, ...secondaryKeySchemaAttributesNames])];
  };

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
    exclusiveStartKey
  }) => {
    assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
    const items = [];
    let lastEvaluatedKey = exclusiveStartKey;
    let count = 0;
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
        parseAsEntity: model.table.name,
        entity: model.table.name
      });
      items.push(...result.Items);
      count += result.Count;
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey !== undefined && (queryLimit === null || items.length < queryLimit));
    return { items, count, lastEvaluatedKey };
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
      exclusiveStartKey = null,
      currentPage = undefined,
      type: cursorType = 'next'
    } = {
      ...fromCursor(cursor),
      ...(limit === undefined ? {} : { limit }),
      ...(scanIndexForward === undefined ? {} : { scanIndexForward })
    };
    const paginationKeys = getPaginationKeys(index);
    const result = await queryItems({
      partitionKey,
      index,
      queryLimit,
      consistent,
      queryScanIndexForward: cursorType === 'previous'
        ? !queryScanIndexForward
        : queryScanIndexForward,
      conditions,
      filters,
      toReturn: toReturn === null ? null : [...new Set([...toReturn, ...paginationKeys])],
      exclusiveStartKey
    });
    const items = result.items.map((item) => setDefaults(item, toReturn));
    if (cursorType === 'previous') {
      items.reverse();
    }
    const page = buildPageObject({
      limit: queryLimit,
      scanIndexForward: queryScanIndexForward,
      count: result.count,
      items,
      currentPage,
      paginationKeys,
      direction: cursorType
    });
    if (toReturn !== null) {
      Retainer(toReturn)(items);
    }
    return {
      items: model.unmarshall(items),
      page
    };
  };
};
