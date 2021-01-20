const createModel = require('./dy/create-model');
const { fromCursor, buildPageObject } = require('../util/paging');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices = {}
  }) => {
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    return ({
      model,
      upsert: (item, { conditions = null } = {}) => model.entity.put(item, {
        ...(conditions === null ? {} : { conditions })
      }),
      update: async (item, {
        returnValues = 'all_new',
        conditions = null
      } = {}) => {
        const result = await model.entity.update(item, {
          returnValues,
          ...(conditions === null ? {} : { conditions })
        });
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
          ...(toReturn === null ? {} : { attributes: toReturn }),
          reverse: scanIndexForward === false,
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
      genSchema: () => null // subset of cloudformation template
    });
  }
});
