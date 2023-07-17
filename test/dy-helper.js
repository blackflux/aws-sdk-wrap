import { expect } from 'chai';
import {
  CreateTableCommand,
  DeleteTableCommand
} from '@aws-sdk/client-dynamodb';
import { Table, Entity } from 'dynamodb-toolbox';
import Index from '../src/index.js';
import DyUtil from '../src/module/dy.js';
import retryStrategy from './helper/retry-strategy.js';
import DocumentClientConstructor from './helper/dy-document-client-constructor.js';
import DyClientConstructor from './helper/dy-client-constructor.js';

const dynamoDB = async (Cmd, params) => {
  const ddb = DyClientConstructor();
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
      'DynamoDB.DocumentClient': DocumentClientConstructor()
    }
  });
  const { LockManager } = DyUtil({
    call: index.call,
    logger: console,
    getService: index.get,
    Table,
    Entity
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
      'DynamoDB.DocumentClient': DocumentClientConstructor()
    }
  });
  const { UcManager } = DyUtil({
    call: index.call,
    logger: console,
    getService: index.get,
    Table,
    Entity
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
      'DynamoDB.DocumentClient': DocumentClientConstructor()
    }
  });
  const Model = (opts) => DyUtil({
    call: index.call,
    logger: null,
    getService: index.get,
    Table,
    Entity
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
    DocumentClient: DocumentClientConstructor(),
    Table,
    Entity
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
