const get = require('lodash.get');
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
    indexes: {
      ...Object.fromEntries(
        Object.entries(indices).map(
          ([indexName, indexDef]) => [
            indexName,
            Object.fromEntries(
              Object.entries(indexDef).filter(
                ([indexDefKey]) => ['partitionKey', 'sortKey'].includes(indexDefKey)
              )
            )
          ]
        )
      )
    },
    entityField: false,
    removeNullAttributes: false,
    DocumentClient
  });
  const entity = new toolbox.Entity({
    name,
    timestamps: false,
    attributes: Object.fromEntries(Object.entries(attributes).map(([k, v]) => {
      if (v.type === 'set' && Array.isArray(v.default) && v.default.length === 0) {
        const { default: _, ...newV } = v;
        return [k, newV];
      }
      return [k, v];
    })),
    table
  });

  const defined = [...new Set([
    partitionKey,
    ...(sortKey === undefined ? [] : [sortKey]),
    ...Object.entries(indices).reduce((p, [k, v]) => {
      [v.partitionKey, v.sortKey].forEach((key) => {
        if (key !== undefined) {
          p.push(key);
        }
      });
      return p;
    }, [])
  ])];

  const schema = {
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
          ProjectionType: get(v, 'projectionType', 'ALL'),
          ...(v.nonKeyAttributes === undefined ? {} : { NonKeyAttributes: v.nonKeyAttributes })
        }
      }))
    }),
    BillingMode: 'PAY_PER_REQUEST'
  };

  return {
    schema,
    table,
    entity
  };
};
