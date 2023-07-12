import { expect } from 'chai';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient
} from '@aws-sdk/client-dynamodb';
import Index from '../src/index.js';
import DyUtil from '../src/module/dy.js';
import retryStrategy from './helper/retry-strategy.js';

const DocumentClient = (cfg = {}) => DynamoDBDocumentClient.from(new DynamoDBClient(cfg), {
  marshallOptions: {
    // Whether to automatically convert empty strings, blobs, and sets to `null`.
    convertEmptyValues: false, // if not false explicitly, we set it to true.
    // Whether to remove undefined values while marshalling.
    removeUndefinedValues: false, // false, by default.
    // Whether to convert typeof object to map attribute.
    convertClassInstanceToMap: false // false, by default.
  },
  unmarshallOptions: {
    // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
    // NOTE: this is required to be true in order to use the bigint data type.
    wrapNumbers: false // false, by default.
  }
});

const dynamoDB = async (Cmd, params) => {
  const ddb = new DynamoDBClient({
    endpoint: 'http://dynamodb-local:8000',
    apiVersion: '2012-08-10',
    region: 'us-west-2',
    accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
    secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  });
  return ddb.send(new Cmd(params));
};

export const LocalTable = (model) => {
  const schema = model.schema;
  return {
    create: async () => dynamoDB(CreateTableCommand, schema),
    delete: async () => dynamoDB(DeleteTableCommand, { TableName: schema.TableName })
  };
};

export const buildLockManager = () => {
  const index = Index({
    config: {
      region: 'us-west-2',
      accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
      secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      retryStrategy,
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    services: {
      'DynamoDB.DocumentClient': DocumentClient({
        endpoint: process.env.DYNAMODB_ENDPOINT
      })
    }
  });
  const { LockManager } = DyUtil({
    call: index.call,
    logger: console,
    getService: index.get
  });
  return LockManager;
};

export const buildUcManager = () => {
  const index = Index({
    config: {
      region: 'us-west-2',
      accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
      secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      retryStrategy,
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    services: {
      'DynamoDB.DocumentClient': DocumentClient({
        endpoint: process.env.DYNAMODB_ENDPOINT
      })
    }
  });
  const { UcManager } = DyUtil({
    call: index.call,
    logger: console,
    getService: index.get
  });
  return UcManager;
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
      retryStrategy,
      endpoint: process.env.DYNAMODB_ENDPOINT
    },
    services: {
      'DynamoDB.DocumentClient': DocumentClient({
        endpoint: process.env.DYNAMODB_ENDPOINT
      })
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
    DocumentClient: DocumentClient({
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

export const deleteItem = async (model, item) => {
  expect(await model.delete(item)).to.deep.equal({
    deleted: true,
    item
  });
};
