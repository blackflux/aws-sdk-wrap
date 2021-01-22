const toolbox = require('dynamodb-toolbox');
const getFirst = require('./get-first');
const validateKwargs = require('./validate-kwargs');

const generateKeySchema = ({ partitionKey, sortKey = null }) => ({
  KeySchema: [
    { AttributeName: partitionKey, KeyType: 'HASH' },
    ...(sortKey === null ? [] : [{ AttributeName: sortKey, KeyType: 'RANGE' }])
  ]
});

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
    indices = {},
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

  const genSchema = () => ({
    TableName: name,
    AttributeDefinitions: Object
      .entries(entity.schema.attributes)
      .filter(([k]) => defined.includes(k))
      .map(([k, v]) => ({
        AttributeName: k,
        AttributeType: convertType(v.type)
      })),
    ...generateKeySchema({ partitionKey, sortKey }),
    ...(Object.keys(indices).length === 0 ? {} : {
      GlobalSecondaryIndexes: Object.entries(indices).map(([k, v]) => ({
        IndexName: k,
        ...generateKeySchema({
          partitionKey: v.partitionKey,
          sortKey: v.sortKey
        }),
        Projection: {
          ProjectionType: 'ALL'
        }
      }))
    }),
    BillingMode: 'PAY_PER_REQUEST'
  });

  return {
    schema: genSchema(),
    table,
    entity
  };
};
