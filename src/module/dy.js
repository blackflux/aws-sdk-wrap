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
    onCreate = async (item) => {},
    onDelete = async (item) => {}
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
    const checkForUndefinedAttributes = (item) => {
      const undefinedAttrs = Object.entries(item)
        .filter(([_, v]) => v === undefined)
        .map(([k, _]) => k);
      if (undefinedAttrs.length !== 0) {
        throw new Error(`Attributes cannot be undefined: ${undefinedAttrs.join(', ')}`);
      }
    };

    const compileFn = (fn) => async (item, {
      conditions: customConditions = null,
      onNotFound = onNotFound_,
      expectedErrorCodes = []
    } = {}) => {
      assert(typeof onNotFound === 'function', onNotFound.length === 1);
      assert(Array.isArray(expectedErrorCodes));
      checkForUndefinedAttributes(item);
      const schema = model.schema;
      let conditions = customConditions;
      if (['update', 'delete'].includes(fn)) {
        conditions = [schema.KeySchema.map(({ AttributeName: attr }) => ({ attr, exists: true }))];
        if (customConditions !== null) {
          conditions.push(Array.isArray(customConditions) ? customConditions : [customConditions]);
        }
      }
      let result;
      try {
        const dyFn = fn === 'upsert' ? 'update' : fn;
        result = await model.entity[dyFn](item, {
          returnValues: fn === 'update' ? 'all_new' : 'all_old',
          ...(conditions === null ? {} : { conditions })
        });
      } catch (err) {
        if (expectedErrorCodes.includes(err.code)) {
          return err.code;
        }
        if (
          ['update', 'delete'].includes(fn)
          && err.code === 'ConditionalCheckFailedException'
          && customConditions === null
        ) {
          const key = extractKey(item);
          return onNotFound(key);
        }
        throw err;
      }
      const hasAttributes = result.Attributes === undefined;
      let onFn;
      switch (fn) {
        case 'upsert':
          onFn = hasAttributes === true ? onCreate : onUpdate;
          break;
        case 'update':
          onFn = onUpdate;
          break;
        default:
          onFn = onDelete;
      }
      await onFn(item);
      return {
        ...(['update', 'upsert'].includes(fn) ? { created: hasAttributes } : { deleted: true }),
        item: setDefaults({
          ...(hasAttributes === true ? {} : result.Attributes),
          ...item
        }, null)
      };
    };
    return ({
      upsert: compileFn('upsert'),
      update: compileFn('update'),
      delete: compileFn('delete'),
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
          items: result.Items.map((item) => setDefaults(item, toReturn)),
          page
        };
      },
      schema: model.schema
    });
  }
});
