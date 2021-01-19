const createModel = require('./dy/create-model');

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
      genSchema: () => null // subset of cloudformation template
    });
  }
});
