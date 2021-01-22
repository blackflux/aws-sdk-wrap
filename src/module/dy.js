const createModel = require('./dy/create-model');
const { fromCursor, buildPageObject } = require('../util/paging');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices
  }) => {
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    return ({
      upsert: async (item, {
        conditions = null
      } = {}) => {
        const result = await model.entity.update(item, {
          returnValues: 'all_old',
          ...(conditions === null ? {} : { conditions })
        });
        return {
          created: result.Attributes === undefined
        };
      },
      update: async (item, {
        returnValues = 'all_new',
        conditions: updateConditions = null
      } = {}) => {
        const schema = model.schema;
        const conditions = schema.KeySchema.map(({ AttributeName: attr }) => ({ attr, exists: true }));
        if (updateConditions !== null) {
          conditions.push(...(Array.isArray(updateConditions) ? updateConditions : [updateConditions]));
        }
        const result = await model.entity.update(item, { returnValues, conditions });
        return result.Attributes;
      },
      getItemOrNull: async (key, { toReturn = null } = {}) => {
        const result = await model.entity.get(key, {
          consistent: true,
          ...(toReturn === null ? {} : { attributes: toReturn })
        });
        return result.Item === undefined ? null : result.Item;
      },
      query: async (partitionKey, {
        index = null,
        limit = 20,
        consistent = true,
        toReturn = null,
        cursor
      } = {}) => {
        const {
          limit: queryLimit = limit,
          scanIndexForward = true,
          lastEvaluatedKey = null,
          currentPage = null
        } = fromCursor(cursor);
        const result = await model.entity.query(partitionKey, {
          ...(index === null ? {} : { index }),
          limit,
          consistent,
          reverse: scanIndexForward === false,
          ...(toReturn === null ? {} : { attributes: toReturn }),
          ...(lastEvaluatedKey === null ? {} : { startKey: lastEvaluatedKey })
        });
        const page = buildPageObject({
          currentPage: currentPage === null ? 1 : currentPage,
          limit: queryLimit,
          lastEvaluatedKey: result.LastEvaluatedKey === undefined ? null : result.LastEvaluatedKey
        });
        return {
          payload: result.Items,
          page
        };
      },
      schema: model.schema
    });
  }
});
