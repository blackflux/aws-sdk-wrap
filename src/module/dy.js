const createModel = require('./dy/create-model');
const { fromCursor, buildPageObject } = require('../util/paging');
const { ModelNotFound } = require('../resources/errors');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices,
    onNotFound = (item) => { throw new ModelNotFound(); },
    onUpdate = async (item) => {},
    onCreate = async (item) => {}
  }) => {
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    const stubDefaults = (itemRaw, toReturn) => {
      const defaults = Object.entries(attributes)
        .filter(([k, v]) => (toReturn === null || toReturn.includes(k)) && v.default !== undefined)
        .map(([key, value]) => [key, value.default()]);
      const item = Object.fromEntries(defaults);
      Object.assign(item, { ...itemRaw });
      return item;
    };
    return ({
      upsert: async (item, {
        conditions = null
      } = {}) => {
        const result = await model.entity.update(item, {
          returnValues: 'all_old',
          ...(conditions === null ? {} : { conditions })
        });
        const created = result.Attributes === undefined;
        const fn = created === true ? onCreate : onUpdate;
        await fn(item);
        return { created };
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
        let result;
        try {
          result = await model.entity.update(item, { returnValues, conditions });
          await onUpdate(item);
        } catch (err) {
          if (err.code === 'ConditionalCheckFailedException') {
            onNotFound(item);
          }
          throw err;
        }
        return result.Attributes;
      },
      getItem: async (key, { toReturn = null } = {}) => {
        const result = await model.entity.get(key, {
          consistent: true,
          ...(toReturn === null ? {} : { attributes: toReturn })
        });
        if (result.Item === undefined) {
          onNotFound(key);
        }
        return stubDefaults(result.Item, toReturn);
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
          limit: queryLimit,
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
          payload: result.Items.map((item) => stubDefaults(item, toReturn)),
          page
        };
      },
      schema: model.schema
    });
  }
});
