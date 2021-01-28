const assert = require('assert');
const createModel = require('./dy/create-model');
const { fromCursor, buildPageObject } = require('../util/paging');
const { ModelNotFound } = require('../resources/errors');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices,
    onNotFound: onNotFound_ = (key) => { throw new ModelNotFound(); },
    onUpdate = async (item) => {},
    onCreate = async (item) => {}
  }) => {
    assert(typeof onNotFound_ === 'function' && onNotFound_.length === 1);
    assert(typeof onUpdate === 'function' && onUpdate.length === 1);
    assert(typeof onCreate === 'function' && onCreate.length === 1);
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    const defaults = Object.entries(attributes)
      .filter(([_, v]) => 'default' in v)
      .map(([k, v]) => [k, v.default]);
    const setDefaults = (item, toReturn) => {
      const entries = toReturn === null ? defaults : defaults.filter(([k]) => toReturn.includes(k));
      return {
        ...entries.reduce((prev, [k, v]) => Object.assign(prev, { [k]: v }), {}),
        ...item
      };
    };
    const extractKey = (item) => model.schema.KeySchema
      .map(({ AttributeName: attr }) => attr)
      .reduce((prev, cur) => {
        // eslint-disable-next-line no-param-reassign
        prev[cur] = item[cur];
        return prev;
      }, {});

    return ({
      upsert: async (item, {
        conditions = null,
        expectedErrorCodes = []
      } = {}) => {
        assert(Array.isArray(expectedErrorCodes));
        let result;
        try {
          result = await model.entity.update(item, {
            returnValues: 'all_old',
            ...(conditions === null ? {} : { conditions })
          });
        } catch (err) {
          if (expectedErrorCodes.includes(err.code)) {
            return err.code;
          }
          throw err;
        }
        const created = result.Attributes === undefined;
        await (created === true ? onCreate : onUpdate)(item);
        return { created };
      },
      update: async (item, {
        returnValues = 'all_new',
        conditions: updateConditions = null,
        onNotFound = onNotFound_,
        expectedErrorCodes = []
      } = {}) => {
        assert(typeof onNotFound === 'function', onNotFound.length === 1);
        assert(Array.isArray(expectedErrorCodes));
        const schema = model.schema;
        const conditions = [schema.KeySchema.map(({ AttributeName: attr }) => ({ attr, exists: true }))];
        if (updateConditions !== null) {
          conditions.push(Array.isArray(updateConditions) ? updateConditions : [updateConditions]);
        }
        let result;
        try {
          result = await model.entity.update(item, { returnValues, conditions });
          await onUpdate(item);
        } catch (err) {
          if (expectedErrorCodes.includes(err.code)) {
            return err.code;
          }
          if (err.code === 'ConditionalCheckFailedException' && updateConditions === null) {
            const key = extractKey(item);
            return onNotFound(key);
          }
          throw err;
        }
        if (['all_old', 'all_new'].includes(returnValues.toLowerCase())) {
          return setDefaults(result.Attributes, null);
        }
        return result.Attributes;
      },
      getItem: async (key, {
        toReturn = null,
        onNotFound = onNotFound_
      } = {}) => {
        assert(typeof onNotFound === 'function', onNotFound.length === 1);
        const result = await model.entity.get(key, {
          consistent: true,
          ...(toReturn === null ? {} : { attributes: toReturn })
        });
        if (result.Item === undefined) {
          return onNotFound(key);
        }
        return setDefaults(result.Item, toReturn);
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
          payload: result.Items.map((item) => setDefaults(item, toReturn)),
          page
        };
      },
      schema: model.schema
    });
  }
});
