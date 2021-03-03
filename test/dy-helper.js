const { DynamoDB } = require('aws-sdk');
const expect = require('chai').expect;
const Index = require('../src');
const DyUtil = require('../src/module/dy');

const { DocumentClient } = DynamoDB;

const dynamoDB = async (cmd, params) => {
  const ddb = new DynamoDB({
    endpoint: 'http://dynamodb-local:8000',
    apiVersion: '2012-08-10',
    region: 'us-west-2',
    accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
    secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  });
  return ddb[cmd](params).promise();
};

module.exports.LocalTable = (model) => {
  const schema = model.schema;
  return {
    create: async () => dynamoDB('createTable', schema),
    delete: async () => dynamoDB('deleteTable', { TableName: schema.TableName })
  };
};

module.exports.buildModel = () => {
  const index = Index({
    config: {
      maxRetries: 0,
      endpoint: process.env.DYNAMODB_ENDPOINT
    }
  });
  const Model = (opts) => DyUtil({
    call: index.call,
    logger: null,
    getService: index.get
  }).Model(opts);
  return Model({
    name: 'table-name',
    attributes: {
      id: { type: 'string', partitionKey: true },
      name: { type: 'string', sortKey: true },
      age: { type: 'number', default: 30 },
      slug: { type: 'string' }
    },
    indices: {
      targetIndex: {
        partitionKey: 'id',
        sortKey: 'name'
      },
      idIndex: {
        partitionKey: 'id'
      }
    },
    DocumentClient: new DocumentClient({
      endpoint: process.env.DYNAMODB_ENDPOINT
    })
  });
};

module.exports.createItems = async ({
  count,
  model,
  primaryKey,
  sortKey,
  age
}) => {
  const items = [];
  for (let i = 1; i <= count; i += 1) {
    const name = i === 1 ? sortKey : `${sortKey}-${i}`;
    const item = {
      id: primaryKey,
      name,
      age: Array.isArray(age) === true ? age[i - 1] : age
    };
    // eslint-disable-next-line no-await-in-loop
    expect(await model.createOrModify(item)).to.deep.equal({ created: true, item });
    items.push(item);
  }
  return items;
};
