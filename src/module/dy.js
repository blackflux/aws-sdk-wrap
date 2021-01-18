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
      update: () => {},
      get: () => {},
      genSchema: () => null // subset of cloudformation template
    });
  }
});
