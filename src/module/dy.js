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
      model, // TODO: maybe don't export
      put: (item, { conditions = null } = {}) => model.entity.put(item, {
        ...(conditions === null ? {} : { conditions })
      }),
      update: () => {},
      get: () => {},
      genSchema: () => null // subset of cloudformation template// remove
    });
  }
});
