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
        name: { type: 'string', sortKey: true }
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
      id: '123',
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
});
