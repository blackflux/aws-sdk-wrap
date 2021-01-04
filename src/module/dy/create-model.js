const toolbox = require('dynamodb-toolbox');
const getFirst = require('./get-first');
const validateKwargs = require('./validate-kwargs');

const convertType = (t) => {
  switch (t) {
    case 'string':
      return 'S';
    case 'number':
      return 'N';
    case 'binary':
      return 'B';
    default:
      throw new Error(`${t} not supported for indexing`);
  }
};

module.exports = (kwargs) => {
  const {
    name,
    attributes,
    indices,
    DocumentClient
  } = validateKwargs(kwargs);

  const partitionKey = getFirst(attributes, ([k, v]) => v.partitionKey === true);
  const sortKey = getFirst(attributes, ([k, v]) => v.sortKey === true);

  const table = new toolbox.Table({
    name,
    partitionKey,
    ...(sortKey === undefined ? {} : { sortKey }),
    indexes: indices,
    entityField: false,
    removeNullAttributes: false,
    DocumentClient
  });
  const entity = new toolbox.Entity({
    name,
    timestamps: false,
    attributes,
    table
  });

  const defined = [
    partitionKey,
    ...(sortKey === undefined ? [] : [sortKey])
  ];

  // todo: define secondary indices
  // ...

  const schema = {
    TableName: name,
    AttributeDefinitions: Object
      .entries(entity.schema.attributes)
      .filter(([k]) => defined.includes(k))
      .map(([k, v]) => ({
        AttributeName: k,
        AttributeType: convertType(v.type)
      })),
    KeySchema: [
      { AttributeName: partitionKey, KeyType: 'HASH' },
      ...(sortKey === undefined ? [] : [{ AttributeName: sortKey, KeyType: 'RANGE' }])
    ],
    // todo: defined secondary indices
    // ...(Object.keys(indices).length === 0 ? {} : {
    //   GlobalSecondaryIndexes: /* ... */
    // }),
    /*
            GlobalSecondaryIndexes:
          - IndexName: parentIndex
            KeySchema:
              - AttributeName: parentHash
                KeyType: HASH
              - AttributeName: child
                KeyType: RANGE
            Projection:
              ProjectionType: ALL
          - IndexName: childIndex
            KeySchema:
              - AttributeName: childHash
                KeyType: HASH
              - AttributeName: parent
                KeyType: RANGE
            Projection:
              ProjectionType: ALL
     */
    BillingMode: 'PAY_PER_REQUEST'
  };

  return {
    schema,
    table,
    entity
  };
};
