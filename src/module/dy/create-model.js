import get from 'lodash.get';
import objectScan from 'object-scan';
import getFirst from './get-first.js';
import validateKwargs from './validate-kwargs.js';

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

export default (kwargs) => {
  const {
    name,
    attributes,
    indices = {},
    DocumentClient,
    Table,
    Entity
  } = validateKwargs(kwargs);

  const partitionKey = getFirst(attributes, ([k, v]) => v.partitionKey === true);
  const sortKey = getFirst(attributes, ([k, v]) => v.sortKey === true);

  const table = new Table({
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
  const entity = new Entity({
    name,
    timestamps: false,
    attributes: Object.fromEntries(Object.entries(attributes).map(([k, v]) => {
      const {
        validate, marshall, unmarshall, ...prunedV
      } = v;
      if (prunedV.type === 'set' && Array.isArray(prunedV.default) && prunedV.default.length === 0) {
        const { default: _, ...newV } = prunedV;
        return [k, newV];
      }
      return [k, prunedV];
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

  const generateMrsl = (fn) => {
    const logic = Object.fromEntries(
      Object
        .entries(attributes)
        .filter(([k, v]) => typeof v?.[fn] === 'function')
        .map(([k, v]) => [`{[*].${k},${k}}`, v])
    );
    return (itemOrItems) => {
      objectScan(
        Object.keys(logic),
        {
          filterFn: ({
            parent, property, value, matchedBy
          }) => {
            matchedBy.forEach((m) => {
              // eslint-disable-next-line no-param-reassign
              parent[property] = logic[m][fn](value);
            });
          }
        }
      )(itemOrItems);
      return itemOrItems;
    };
  };

  return {
    schema,
    table,
    entity,
    marshall: generateMrsl('marshall'),
    unmarshall: generateMrsl('unmarshall')
  };
};
