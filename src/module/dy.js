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
      update: () => {},
      get: () => {},
      genSchema: () => null // subset of cloudformation template
    });
  }
});
