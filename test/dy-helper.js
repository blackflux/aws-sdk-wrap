import AWS from 'aws-sdk';
import { expect } from 'chai';
import Index from '../src/index.js';
import DyUtil from '../src/module/dy.js';

const { DynamoDB } = AWS;
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

export const LocalTable = (model) => {
  const schema = model.schema;
  return {
    create: async () => dynamoDB('createTable', schema),
    delete: async () => dynamoDB('deleteTable', { TableName: schema.TableName })
  };
};

export const buildLockManager = () => {
  const index = Index({
    config: {
      region: 'us-west-2',
      accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
      secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      maxRetries: 0,
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    services: {
      'DynamoDB.DocumentClient': AWS.DynamoDB.DocumentClient
    }
  });
  const { LockManager } = DyUtil({
    call: index.call,
    logger: console,
    getService: index.get
  });
  return LockManager;
};

export const buildModel = ({
  extraAttrs = null,
  extraIndices = null,
  onUpdate = null,
  onCreate = null,
  onDelete = null
} = {}) => {
  const index = Index({
    config: {
      maxRetries: 0,
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    services: {
      'DynamoDB.DocumentClient': AWS.DynamoDB.DocumentClient
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
      slug: { type: 'string' },
      ...(extraAttrs === null ? {} : { ...extraAttrs })
    },
    indices: {
      targetIndex: {
        partitionKey: 'id',
        sortKey: 'name'
      },
      idIndex: {
        partitionKey: 'id'
      },
      ageIndex: {
        partitionKey: 'age',
        sortKey: 'id'
      },
      ...(extraIndices === null ? {} : { ...extraIndices })
    },
    ...(onUpdate === null ? {} : { onUpdate }),
    ...(onCreate === null ? {} : { onCreate }),
    ...(onDelete === null ? {} : { onDelete }),
    DocumentClient: new DocumentClient({
      endpoint: process.env.DYNAMODB_ENDPOINT
    })
  });
};

export const createItems = async ({
  count,
  model,
  primaryKey,
  sortKey,
  age,
  extraAttrs = null
}) => {
  const items = [];
  for (let i = 1; i <= count; i += 1) {
    const name = i === 1 ? sortKey : `${sortKey}-${i}`;
    const item = {
      id: primaryKey,
      name,
      age: Array.isArray(age) === true ? age[i - 1] : age,
      ...(extraAttrs === null ? {} : extraAttrs)
    };
    // eslint-disable-next-line no-await-in-loop
    expect(await model.createOrModify(item)).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    items.push(item);
  }
  return items;
};
