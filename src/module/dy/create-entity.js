const toolbox = require('dynamodb-toolbox');
const getFirst = require('./get-first');

// todo: write unit test
module.exports = ({
  name,
  attributes,
  indexes,
  DocumentClient
}) => {
  // todo: do joi validation here
  // ...

  const partitionKey = getFirst(attributes, ([k, v]) => v.partitionKey === true);
  const sortKey = getFirst(attributes, ([k, v]) => v.sortKey === true);

  const table = new toolbox.Table({
    name,
    ...(partitionKey === undefined ? {} : { partitionKey }),
    ...(sortKey === undefined ? {} : { sortKey }),
    indexes,
    entityField: false,
    removeNullAttributes: false,
    DocumentClient
  });

  return {
    entity: new toolbox.Entity({
      name,
      timestamps: false,
      attributes,
      table
    }),
    // todo: generate schema (use structure from sls cloudformation) and put into output
    // todo: write more unit test (!)
    schema: {}
  };
};
