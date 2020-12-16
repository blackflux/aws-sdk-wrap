const Joi = require('joi-strict');

const schema = Joi.object().keys({
  name: Joi.string(),
  attributes: Joi.object().pattern(
    Joi.string(),
    // todo: must have exactly one value with partitionKey
    // todo: must have zero or one value with partitionKey
    Joi.object().keys({
      type: Joi.string().valid('string', 'boolean', 'number', 'list', 'map', 'binary', 'set'),
      partitionKey: Joi.boolean().valid(true).optional(),
      sortKey: Joi.boolean().valid(true).optional()
    }).nand('partitionKey', 'sortKey')
  ),
  indices: Joi.object().pattern(
    Joi.string(),
    Joi.object().keys({
      // todo: check that value is present in attributes
      partitionKey: Joi.string().optional(),
      // todo: check that value is present in attributes
      sortKey: Joi.string().optional()
    }).or('partitionKey', 'sortKey')
  ),
  DocumentClient: Joi.object()
});

module.exports = (kwargs) => {
  const result = schema.validate(kwargs);

  if (result.error) {
    throw new Error(result.error);
  }

  /*
    if (Object.keys(indexes).length > 0) {
    Object.entries(indexes).forEach(([_, att]) => {
      Object.entries(att).filter(([k, _]) => k === 'partitionKey').map(([_, a]) => a)[0];
      const idxAttrNameSk = Object.entries(att).filter(([k, _]) => k === 'sortKey').map(([_, a]) => a)[0];
      partitionKey == idx
   */

  return result.value;
};
