const assert = require('assert');
const Joi = require('joi-strict');
const objectFields = require('object-fields');
const MergeAttributes = require('./util/merge-attributes');
const ValidateItem = require('./util/validate-item');
const generateItemRewriter = require('./util/generate-item-rewriter');

module.exports = ({
  attributes,
  model,
  onNotFound_,
  onAlreadyExists_,
  onUpdate,
  onCreate,
  onDelete
}) => {
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
  const sets = Object.entries(attributes).filter(([_, v]) => v.type === 'set').map(([k]) => k);
  const numbers = Object.entries(attributes).filter(([_, v]) => v.type === 'number').map(([k]) => k);
  const mergeAttributes = MergeAttributes({ sets, numbers });
  const validateItem = ValidateItem(attributes);
  const itemRewriterByFn = {
    update: generateItemRewriter('update', sets),
    put: generateItemRewriter('put', sets),
    delete: generateItemRewriter('delete', sets)
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

  return {
    validateSecondaryIndex: (index) => {
      const secondaryIndex = model.schema.GlobalSecondaryIndexes.find(({ IndexName }) => IndexName === index);
      if (secondaryIndex === undefined) {
        throw new Error(`Invalid index provided: ${index}`);
      }
    },
    setDefaults,
    getSortKeyByIndex: (index) => {
      const keySchema = index === null
        ? model.schema.KeySchema
        : model.schema.GlobalSecondaryIndexes.find(({ IndexName }) => IndexName === index).KeySchema;
      const sortKey = keySchema.find(({ KeyType: keyType }) => keyType === 'RANGE');
      if (sortKey === undefined) {
        throw new Error('No sortKey present on index');
      }
      return sortKey.AttributeName;
    },
    compileFn: (fn, mustExist) => async (...args) => {
      Joi.array().ordered(
        Joi.object(),
        Joi.object().keys({
          conditions: Joi.alternatives(Joi.object(), Joi.array()).optional(),
          onNotFound: Joi.function().arity(1).optional(),
          onAlreadyExists: Joi.function().arity(1).optional(),
          expectedErrorCodes: Joi.array().items(Joi.string()).unique().optional(),
          // eslint-disable-next-line newline-per-chained-call
          toReturn: Joi.array().items(Joi.string()).unique().min(1).optional()
        })
      );
      const [item, {
        conditions: customConditions = null,
        onNotFound = onNotFound_,
        onAlreadyExists = onAlreadyExists_,
        expectedErrorCodes = [],
        toReturn = null
      } = {}] = args;
      assert(typeof onNotFound === 'function', onNotFound.length === 1);
      assert(Array.isArray(expectedErrorCodes));
      assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
      checkForUndefinedAttributes(item);
      validateItem(item);
      let conditions = customConditions;
      if (mustExist !== null) {
        conditions = model.schema.KeySchema
          .filter(({ KeyType }) => KeyType === 'HASH')
          .map(({ AttributeName: attr }) => ({ attr, exists: mustExist }));
        if (customConditions !== null) {
          conditions.push(Array.isArray(customConditions) ? customConditions : [customConditions]);
        }
      }
      let result;
      try {
        result = await model.entity[fn](
          itemRewriterByFn[fn](item),
          {
            returnValues: 'all_old',
            ...(conditions === null ? {} : { conditions })
          }
        );
      } catch (err) {
        if (expectedErrorCodes.includes(err.code)) {
          return err.code;
        }
        if (
          mustExist !== null
          && err.code === 'ConditionalCheckFailedException'
          && customConditions === null
        ) {
          return (mustExist ? onNotFound : onAlreadyExists)(extractKey(item));
        }
        throw err;
      }
      const didNotExist = result.Attributes === undefined;
      const mergedItem = mergeAttributes(
        (didNotExist || fn === 'put') ? {} : result.Attributes,
        item
      );
      const resultItem = setDefaults(mergedItem, null);
      if (['update', 'put'].includes(fn)) {
        await (didNotExist ? onCreate : onUpdate)(resultItem);
      } else {
        await onDelete(resultItem);
      }
      if (toReturn !== null) {
        assert(toReturn.every((e) => e in attributes), 'Unknown field in "toReturn" provided');
        objectFields.Retainer(toReturn)(resultItem);
      }
      return {
        ...(['update', 'put'].includes(fn) ? { created: didNotExist } : { deleted: true }),
        item: resultItem
      };
    }
  };
};
