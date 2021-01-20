const expect = require('chai').expect;
const { DynamoDB } = require('aws-sdk');
const { describe } = require('node-tdd');
const Index = require('../../src');
const DyUtil = require('../../src/module/dy');
const { LocalTable } = require('../dy-helper');

const { DocumentClient } = DynamoDB;

describe('Testing dy Util', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../default.env.yml'
}, () => {
  let Model;
  let model;
  let localTable;
  let item;
  let primaryKey;

  before(() => {
    primaryKey = '123';
  });
  beforeEach(async () => {
    const index = Index({
      config: {
        maxRetries: 0,
        endpoint: process.env.DYNAMODB_ENDPOINT
      }
    });
    Model = (opts = {}) => DyUtil({
      call: index.call,
      logger: null,
      getService: index.get
    }).Model(opts);
    model = Model({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', sortKey: true },
        age: { type: 'number' }
      },
      indices: {
        targetIndex: {
          // todo: this should error the way that is is
          partitionKey: 'id',
          sortKey: 'name'
        }
      },
      DocumentClient: new DocumentClient({
        endpoint: process.env.DYNAMODB_ENDPOINT
      })
    });
    localTable = LocalTable(model.model);
    await localTable.create();
    item = {
      id: primaryKey,
      name: 'name'
    };
  });
  afterEach(async () => {
    await localTable.tearDown();
  });

  it('Testing basic logic', () => {
    expect(Object.keys(model)).to.deep.equal([
      'model',
      'upsert',
      'update',
      'getItemOrNull',
      'query',
      'genSchema'
    ]);
  });

  it('Testing upsert', async () => {
    const result = await model.upsert(item);
    expect(result).to.deep.equal({});
  });

  it('Testing upsert with conditions', async () => {
    const result = await model.upsert(item, { conditions: { attr: 'name', exists: false } });
    expect(result).to.deep.equal({});
  });

  it('Testing upsert with ConditionalCheckFailedException', async ({ capture }) => {
    const error = await capture(() => model.upsert(item, { conditions: { attr: 'name', exists: true } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing getItemOrNull', async () => {
    const upsertResult = await model.upsert(item);
    expect(upsertResult).to.deep.equal({});
    const result = await model.getItemOrNull(item);
    expect(result).to.deep.equal(item);
  });

  it('Testing getItemOrNull returns null', async () => {
    const result = await model.getItemOrNull(item);
    expect(result).to.equal(null);
  });

  it('Testing getItemOrNull with toReturn', async () => {
    const upsertResult = await model.upsert(item);
    expect(upsertResult).to.deep.equal({});
    const result = await model.getItemOrNull(item, { toReturn: ['name'] });
    expect(result).to.deep.equal({ name: 'name' });
  });

  it('Testing update', async () => {
    const itemToUpdate = {
      ...item,
      age: 50
    };
    const upsertResult = await model.upsert(itemToUpdate);
    expect(upsertResult).to.deep.equal({});
    itemToUpdate.age = 55;
    const result = await model.update(itemToUpdate);
    expect(result).to.deep.equal(itemToUpdate);
  });

  it('Testing update with conditions', async () => {
    const itemToUpdate = {
      ...item,
      age: 50
    };
    const upsertResult = await model.upsert(itemToUpdate);
    expect(upsertResult).to.deep.equal({});
    itemToUpdate.age = 55;
    const result = await model.update(itemToUpdate, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal(itemToUpdate);
  });

  it('Testing update with returnValues', async () => {
    const oldItem = {
      ...item,
      age: 50
    };
    const upsertResult = await model.upsert(oldItem);
    expect(upsertResult).to.deep.equal({});
    const result = await model.update({
      ...item,
      age: 55
    }, { returnValues: 'all_old' });
    expect(result).to.deep.equal(oldItem);
  });

  it('Testing update with ConditionalCheckFailedException', async ({ capture }) => {
    const itemToUpdate = {
      ...item,
      age: 50
    };
    const upsertResult = await model.upsert(itemToUpdate);
    expect(upsertResult).to.deep.equal({});
    itemToUpdate.age = 55;
    const error = await capture(() => model.update(itemToUpdate, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing query', async () => {
    expect(await model.upsert(item)).to.deep.equal({});
    const result = await model.query(primaryKey);
    expect(result).to.deep.equal({
      payload: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with limit', async () => {
    expect(await model.upsert(item)).to.deep.equal({});
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      payload: [item],
      page: {
        next: {
          limit: 1,
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZSIsImlkIjoiMTIzIn0sImN1cnJlbnRQYWdlIjoyfQ=='
        },
        index: { current: 1 },
        size: 1
      }
    });
  });

  it('Testing query with toReturn', async () => {
    expect(await model.upsert(item)).to.deep.equal({});
    const result = await model.query(primaryKey, { toReturn: ['name'] });
    expect(result).to.deep.equal({
      payload: [{ name: 'name' }],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with index', async () => {
    expect(await model.upsert(item)).to.deep.equal({});
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false
    });
    expect(result).to.deep.equal({
      payload: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with cursor', async () => {
    expect(await model.upsert(item)).to.deep.equal({});
    const result = await model.query(primaryKey, {
      // eslint-disable-next-line max-len
      cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZSIsImlkIjoiMTIzIn0sImN1cnJlbnRQYWdlIjoyfQ=='
    });
    expect(result).to.deep.equal({
      payload: [],
      page: {
        next: null,
        index: { current: 2 },
        size: 1
      }
    });
  });
});
