const createEntity = require('./dy/create-entity');

module.exports = ({ call, getService, logger }) => ({
  Table: ({
    name,
    attributes,
    indices = {}
  }) => {
    const { entity } = createEntity({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    return ({
      schema: () => {},
      update: () => {},
      get: () => {},
      genSchema: () => null // subset of cloudformation template
    });
  }
});
