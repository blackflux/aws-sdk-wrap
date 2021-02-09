const assert = require('assert');
const Joi = require('joi-strict');
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
    const getSortKeyByIndex = (index) => {
      const keySchema = index === null
        ? model.schema.KeySchema
        : model.schema.GlobalSecondaryIndexes.find(({ IndexName }) => IndexName === index).KeySchema;
      const sortKey = keySchema.find(({ KeyType: keyType }) => keyType === 'RANGE');
      if (sortKey === undefined) {
        throw new Error('No sortKey present on index');
      }
      return sortKey.AttributeName;
    };

    const compileFn = (fn, mustExist) => async (item, {
      conditions: customConditions = null,
      onNotFound = onNotFound_,
      expectedErrorCodes = []
    } = {}) => {
      assert(typeof onNotFound === 'function', onNotFound.length === 1);
      assert(Array.isArray(expectedErrorCodes));
      checkForUndefinedAttributes(item);
      let conditions = customConditions;
      if (mustExist) {
        conditions = [model.schema.KeySchema.map(({ AttributeName: attr }) => ({ attr, exists: true }))];
        if (customConditions !== null) {
          conditions.push(Array.isArray(customConditions) ? customConditions : [customConditions]);
        }
      }
      let result;
      try {
        result = await model.entity[fn](item, {
          returnValues: 'all_old',
          ...(conditions === null ? {} : { conditions })
        });
      } catch (err) {
        if (expectedErrorCodes.includes(err.code)) {
          return err.code;
        }
        if (
          mustExist
          && err.code === 'ConditionalCheckFailedException'
          && customConditions === null
        ) {
          return onNotFound(extractKey(item));
        }
        throw err;
      }
      const didNotExist = result.Attributes === undefined;
      if (fn === 'update') {
        await (didNotExist ? onCreate : onUpdate)(item);
      } else {
        await onDelete(item);
      }
      return {
        ...(fn === 'update' ? { created: didNotExist } : { deleted: true }),
        item: setDefaults({
          ...(didNotExist ? {} : result.Attributes),
          ...item
        }, null)
      };
    };
    return ({
      upsert: compileFn('update', false),
      update: compileFn('update', true),
      delete: compileFn('delete', true),
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
        conditions = null,
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
          const querySchema = Joi.object({
            attr: Joi.string().valid(getSortKeyByIndex(index))
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
          Joi.assert(conditions, querySchema, 'Invalid conditions provided');
        }
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
          ...(conditions === null ? {} : Object.entries(conditions)
            .filter(([k, _]) => k !== 'attr')
            .reduce((prev, [k, v]) => {
              // eslint-disable-next-line no-param-reassign
              prev[k] = v;
              return prev;
            }, {})),
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
