const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel } = require('../../../dy-helper');

describe('Testing create-or-modify', {
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

  it('Testing createOrModify item created', async () => {
    expect(await model.createOrModify(item)).to.deep.equal({ created: true, item });
  });

  it('Testing createOrModify with default', async () => {
    delete item.age;
    const itemWithDefault = {
      ...item,
      age: 30
    };
    expect(await model.createOrModify(item)).to.deep.equal({
      created: true,
      item: itemWithDefault
    });
    const result = await model.getItem(item);
    expect(result).to.deep.equal(itemWithDefault);
  });

  it('Testing createOrModify item updated', async () => {
    expect(await model.createOrModify(item)).to.deep.equal({ created: true, item });
    item.age = 51;
    expect(await model.createOrModify(item)).to.deep.equal({ created: false, item });
  });

  it('Testing createOrModify with conditions', async () => {
    const result = await model.createOrModify(item, { conditions: { attr: 'name', exists: false } });
    expect(result).to.deep.equal({ created: true, item });
  });

  it('Testing createOrModify with ConditionalCheckFailedException', async ({ capture }) => {
    const error = await capture(() => model.createOrModify(item, { conditions: { attr: 'name', exists: true } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing createOrModify with expectedErrorCodes', async () => {
    const result = await model.createOrModify(item, {
      conditions: { attr: 'name', exists: true },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing createOrModify with undefined attribute', async ({ capture }) => {
    const error = await capture(() => model.createOrModify({
      id: primaryKey,
      name: 'name',
      age: undefined
    }));
    expect(error.message).to.equal('Attributes cannot be undefined: age');
  });

  it('Testing createOrModify wrong attribute type', async ({ capture }) => {
    const error = await capture(() => model.createOrModify({
      id: primaryKey,
      name: 'name',
      age: 'number'
    }));
    expect(error.message).to.equal('Could not convert \'number\' to a number for \'age\'');
  });

  it('Testing createOrModify with toReturn', async () => {
    expect(await model.createOrModify(item, { toReturn: ['age'] })).to.deep.equal({
      created: true,
      item: { age: 50 }
    });
  });
});
