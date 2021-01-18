const expect = require('chai').expect;
const { DynamoDB } = require('aws-sdk');
const { describe } = require('node-tdd');
const Index = require('../../src');
const DyUtil = require('../../src/module/dy');
const { LocalTable } = require('../dy-helper');

const { DocumentClient } = DynamoDB;

describe('Testing dy Util', { useNock: true, nockStripHeaders: true, timeout: 55000 }, () => {
  let Model;
  let model;
  let localTable;
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
  });
  afterEach(async () => {
    await localTable.tearDown();
  });

  it('Testing basic logic', () => {
    expect(Object.keys(model)).to.deep.equal([
      'model',
      'put',
      'update',
      'get',
      'genSchema'
    ]);
  });

  it('Testing put', async () => {
    const item = {
      id: 123,
      name: 'name'
    };
    const result = await model.put(item);
    expect(result).to.deep.equal({});
  });

  it('Testing put with conditions', async () => {
    const item = {
      id: 123,
      name: 'name'
    };
    const result = await model.put(item, { conditions: { attr: 'name', exists: false } });
    expect(result).to.deep.equal({});
  });

  it('Testing put with ConditionalCheckFailedException', async ({ capture }) => {
    const item = {
      id: 123,
      name: 'name'
    };
    const error = await capture(() => model.put(item, { conditions: { attr: 'name', exists: true } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });
});
