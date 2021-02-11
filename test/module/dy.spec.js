const expect = require('chai').expect;
const { DynamoDB } = require('aws-sdk');
const { describe } = require('node-tdd');
const Index = require('../../src');
const DyUtil = require('../../src/module/dy');
const { LocalTable } = require('../dy-helper');
const { ModelNotFound } = require('../../src/resources/errors');

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
  let setupThreeItems;

  before(() => {
    primaryKey = '123';
    setupThreeItems = async () => {
      const secondItem = {
        ...item,
        name: 'name-2'
      };
      const thirdItem = {
        ...item,
        name: 'name-3'
      };
      expect(await model.upsert(item)).to.deep.equal({ created: true, item });
      expect(await model.upsert(secondItem)).to.deep.equal({
        created: true,
        item: secondItem
      });
      expect(await model.upsert(thirdItem)).to.deep.equal({
        created: true,
        item: thirdItem
      });
      return [item, secondItem, thirdItem];
    };
  });
  beforeEach(async () => {
    const index = Index({
      config: {
        maxRetries: 0,
        endpoint: process.env.DYNAMODB_ENDPOINT
      }
    });
    Model = (opts) => DyUtil({
      call: index.call,
      logger: null,
      getService: index.get
    }).Model(opts);
    model = Model({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', sortKey: true },
        age: { type: 'number', default: 30 }
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
    localTable = LocalTable(model);
    await localTable.create();
    item = {
      id: primaryKey,
      name: 'name',
      age: 50
    };
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing basic logic', () => {
    expect(Object.keys(model)).to.deep.equal([
      'upsert',
      'update',
      'delete',
      'getItem',
      'query',
      'schema'
    ]);
  });

  it('Testing upsert item created', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
  });

  it('Testing upsert with default', async () => {
    delete item.age;
    const itemWithDefault = {
      ...item,
      age: 30
    };
    expect(await model.upsert(item)).to.deep.equal({
      created: true,
      item: itemWithDefault
    });
    const result = await model.getItem(item);
    expect(result).to.deep.equal(itemWithDefault);
  });

  it('Testing upsert item updated', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 51;
    expect(await model.upsert(item)).to.deep.equal({ created: false, item });
  });

  it('Testing upsert with conditions', async () => {
    const result = await model.upsert(item, { conditions: { attr: 'name', exists: false } });
    expect(result).to.deep.equal({ created: true, item });
  });

  it('Testing upsert with ConditionalCheckFailedException', async ({ capture }) => {
    const error = await capture(() => model.upsert(item, { conditions: { attr: 'name', exists: true } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing upsert with expectedErrorCodes', async () => {
    const result = await model.upsert(item, {
      conditions: { attr: 'name', exists: true },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing upsert with undefined attribute', async ({ capture }) => {
    const error = await capture(() => model.upsert({
      id: primaryKey,
      name: 'name',
      age: undefined
    }));
    expect(error.message).to.equal('Attributes cannot be undefined: age');
  });

  it('Testing upsert wrong attribute type', async ({ capture }) => {
    const error = await capture(() => model.upsert({
      id: primaryKey,
      name: 'name',
      age: 'number'
    }));
    expect(error.message).to.equal('Could not convert \'number\' to a number for \'age\'');
  });

  it('Testing delete', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.delete(item);
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete throws ModelNotFound error', async ({ capture }) => {
    const error = await capture(() => model.delete(item));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing delete with onNotFound', async () => {
    const logs = [];
    const result = await model.delete(item, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing delete with conditions', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.delete(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete with expectedErrorCodes', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.delete(item, {
      conditions: { attr: 'age', eq: 1 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing delete with unknown error', async ({ capture }) => {
    const error = await capture(() => model.delete(item));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing getItem', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.getItem(item);
    expect(result).to.deep.equal(item);
  });

  it('Testing getItem throws ModelNotFound error', async ({ capture }) => {
    const error = await capture(() => model.getItem(item));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing getItem onNotFound', async () => {
    const logs = [];
    const result = await model.getItem(item, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing getItem with toReturn', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.getItem(item, { toReturn: ['name'] });
    expect(result).to.deep.equal({ name: 'name' });
  });

  it('Testing getItem with stubbed defaults', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.getItem(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      age: 30
    });
  });

  it('Testing update', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 55;
    const result = await model.update(item);
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with conditions', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 55;
    const result = await model.update(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with conditions as array', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 55;
    const result = await model.update(item, { conditions: [{ attr: 'age', eq: 50 }] });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with item not found with conditions', async ({ capture }) => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 55;
    const error = await capture(() => model.update(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing update with unknown error', async ({ capture }) => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    item.age = 55;
    const error = await capture(() => model.update(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing update with item does not exist', async ({ capture }) => {
    const error = await capture(() => model.update(item));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing update with onNotFound', async () => {
    const logs = [];
    const result = await model.update(item, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing update with expectedErrorCodes', async () => {
    const result = await model.update(item, {
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing query', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey);
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with limit', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const item2 = {
      id: primaryKey,
      name: 'name-2',
      age: 25
    };
    expect(await model.upsert(item2)).to.deep.equal({
      created: true,
      item: item2
    });
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      items: [item],
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
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey, { toReturn: ['name'] });
    expect(result).to.deep.equal({
      items: [{ name: 'name' }],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with index', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with conditions', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey, {
      conditions: { attr: 'name', eq: 'name' }
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with conditions sortKey unknown', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey, {
      conditions: { attr: 'name', eq: 'unknown' }
    });
    expect(result).to.deep.equal({
      items: [],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query on secondary index with conditions', async () => {
    expect(await model.upsert(item)).to.deep.equal({ created: true, item });
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false,
      conditions: { attr: 'name', eq: 'name' }
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query on invalid index', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, { index: 'invalid' }));
    expect(error.message).to.equal('Invalid index provided: invalid');
  });

  it('Testing query with invalid conditions', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      conditions: { attr: 'name', invalid: 'name' }
    }));
    expect(error.message).to.have.string('Invalid conditions provided');
  });

  it('Testing query with bad sortKey name', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      conditions: { attr: 'invalid', eq: 'name' }
    }));
    expect(error.message).to.have.string('Expected conditions.attr to be "name"');
  });

  it('Testing query on index without sortKey', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      index: 'idIndex',
      conditions: { attr: 'invalid', eq: 'name' }
    }));
    expect(error.message).to.equal('No sortKey present on index');
  });

  it('Testing query with cursor', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const firstResult = await model.query(primaryKey, { limit: 2 });
    expect(firstResult).to.deep.equal({
      items: [firstItem, secondItem],
      page: {
        next: {
          limit: 2,
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZS0yIiwiaWQiOiIxMjMifSwiY3VycmVudFBhZ2UiOjJ9'
        },
        index: { current: 1 },
        size: 2
      }
    });
    const secondResult = await model.query(primaryKey, { cursor: firstResult.page.next.cursor });
    expect(secondResult).to.deep.equal({
      items: [thirdItem],
      page: {
        next: null,
        index: { current: 2 },
        size: 2
      }
    });
  });

  it('Testing query exhaustive pagination with limit null', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: null });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: null
      }
    });
  });

  it('Testing query exhaustive pagination with limit not reached', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 3 });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 3
      }
    });
  });

  it('Testing query with limit of 1', async () => {
    const [firstItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      items: [firstItem],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZSIsImlkIjoiMTIzIn0sImN1cnJlbnRQYWdlIjoyfQ==',
          limit: 1
        },
        index: { current: 1 },
        size: 1
      }
    });
  });

  it('Testing query with limit of 4', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 4 });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 4
      }
    });
  });

  it('Testing schema', ({ fixture }) => {
    const result = model.schema;
    expect(result).to.deep.equal(fixture('table-schema'));
  });
});
