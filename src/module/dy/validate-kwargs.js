const Joi = require('joi-strict');

const schema = Joi.object().keys({
  name: Joi.string(),
  attributes: Joi.object().pattern(
    Joi.string(),
    Joi.object().keys({
      type: Joi.string().valid('string', 'boolean', 'number', 'list', 'map', 'binary', 'set'),
      partitionKey: Joi.boolean().valid(true).optional(),
      sortKey: Joi.boolean().valid(true).optional()
    }).nand('partitionKey', 'sortKey')
  ).min(1).custom((v, h) => {
    const propertyCount = {};
    Object.values(v).forEach((o) => Object.keys(o).forEach((k) => {
      if (propertyCount[k] === undefined) {
        propertyCount[k] = 1;
      } else {
        propertyCount[k] += 1;
      }
    }));
    if (propertyCount.partitionKey === undefined) {
      return h.message('At least one partitionKey must be defined');
    }
    if (propertyCount.partitionKey > 1) {
      return h.message('Duplicated partitionKey definition');
    }
    if (propertyCount.sortKey !== undefined && propertyCount.sortKey > 1) {
      return h.message('Duplicated sortKey definition');
    }
    return v;
  }),
  indices: Joi.object().pattern(
    Joi.string(),
    Joi.object().keys({
      partitionKey: Joi.string().optional(),
      sortKey: Joi.string().optional()
    }).or('partitionKey', 'sortKey')
  ).optional().min(1)
    .custom((v, h) => {
      const valid = Object.values(v)
        .every((idx) => ([...new Set(Object.values(idx))].length === Object.keys(idx).length));
      if (valid === false) {
        return h.message('Can\'t use the same attribute as partitionKey and sortKey');
      }
      return v;
    }),
  DocumentClient: Joi.object()
}).custom((v, h) => {
  const { attributes, indices } = v;
  if (indices !== undefined) {
    const valid = Object.values(indices)
      .every((idx) => Object.keys(attributes)
        .includes(Object.values(idx)[0]));
    if (valid === false) {
      return h.message('Indices values must match with defined attributes');
    }
  }
  return v;
});

module.exports = (kwargs) => {
  const result = schema.validate(kwargs);
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
};
