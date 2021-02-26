const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel } = require('../../../dy-helper');

describe('Testing upsert', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let item;
  let primaryKey;

  before(() => {
    primaryKey = '123';
  });
  beforeEach(async () => {
    model = buildModel();
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
});
