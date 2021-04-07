const assert = require('assert');
const objectFields = require('object-fields');
const MergeAttributes = require('./util/merge-attributes');
const GenerateItemRewriter = require('./util/generate-item-rewriter');

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
  const mergeAttributes = MergeAttributes(sets);
  const generateItemByFn = {
    update: GenerateItemRewriter('update', sets),
    put: GenerateItemRewriter('put', sets),
    delete: GenerateItemRewriter('delete', sets)
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
    compileFn: (fn, mustExist) => async (item, {
      conditions: customConditions = null,
      onNotFound = onNotFound_,
      onAlreadyExists = onAlreadyExists_,
      expectedErrorCodes = [],
      toReturn = null
    } = {}) => {
      assert(typeof onNotFound === 'function', onNotFound.length === 1);
      assert(Array.isArray(expectedErrorCodes));
      assert(toReturn === null || (Array.isArray(toReturn) && toReturn.length === new Set(toReturn).size));
      checkForUndefinedAttributes(item);
      let conditions = customConditions;
      if (mustExist !== null) {
        conditions = [model.schema.KeySchema.map(({ AttributeName: attr }) => ({ attr, exists: mustExist }))];
        if (customConditions !== null) {
          conditions.push(Array.isArray(customConditions) ? customConditions : [customConditions]);
        }
      }
      let result;
      try {
        result = await model.entity[fn](
          generateItemByFn[fn](item),
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
