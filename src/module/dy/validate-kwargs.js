import Joi from 'joi-strict';

const schema = Joi.object().keys({
  name: Joi.string(),
  attributes: Joi.object().pattern(
    Joi.string(),
    Joi.object().keys({
      type: Joi.string().valid('string', 'boolean', 'number', 'list', 'map', 'set', 'binary'),
      partitionKey: Joi.boolean().valid(true).optional(),
      sortKey: Joi.boolean().valid(true).optional(),
      default: Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.array(),
        Joi.object(),
        Joi.function()
      )
        .optional()
        .allow(null),
      validate: Joi.function().arity(1).custom((v, h) => {
        if (v.constructor.name === 'AsyncFunction') {
          return h.message('Validate cannot be asynchronous');
        }
        return v;
      }).optional()
    }).nand('partitionKey', 'sortKey')
  ).min(1).custom((v, h) => {
    const attributeValues = Object.values(v);
    const partitionKeyCount = attributeValues.filter((a) => a.partitionKey === true).length;
    const sortKeyCount = attributeValues.filter((a) => a.sortKey === true).length;
    if (partitionKeyCount === 0) {
      return h.message('At least one partitionKey must be defined');
    }
    if (partitionKeyCount > 1) {
      return h.message('Duplicated partitionKey definition');
    }
    if (sortKeyCount > 1) {
      return h.message('Duplicated sortKey definition');
    }
    return v;
  }),
  indices: Joi.object().pattern(
    Joi.string(),
    Joi.object().keys({
      partitionKey: Joi.string(),
      sortKey: Joi.string().optional(),
      nonKeyAttributes: Joi.alternatives().conditional('projectionType', {
        is: 'INCLUDE',
        then: Joi.array().items(Joi.string()),
        otherwise: Joi.forbidden()
      }),
      projectionType: Joi.string().valid('KEYS_ONLY', 'INCLUDE', 'ALL').optional()
    })
  ).optional().min(1)
    .custom((v, h) => {
      const valid = Object.values(v)
        .every((idx) => Object.keys(idx).length === 0 || idx.partitionKey !== idx.sortKey);
      if (valid !== true) {
        return h.message('Cannot use the same attribute for partitionKey and sortKey');
      }
      return v;
    }),
  DocumentClient: Joi.object()
}).custom((v, h) => {
  const { attributes, indices } = v;
  if (indices !== undefined) {
    const indexKeys = [];
    Object.values(indices).forEach((index) => {
      Object.entries(index).forEach(([key, field]) => {
        if (['partitionKey', 'sortKey'].includes(key)) {
          indexKeys.push(field);
        }
      });
    });
    const foundKeys = indexKeys.filter((idx) => Object.keys(attributes).includes(idx));
    if (foundKeys.length !== indexKeys.length) {
      return h.message('Indices values must match with defined attributes');
    }
  }
  return v;
});

export default (kwargs) => {
  const result = schema.validate(kwargs);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.value;
};
