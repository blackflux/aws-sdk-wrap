const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel, createItems } = require('../../../dy-helper');
const { ModelNotFound } = require('../../../../src/resources/errors');

describe('Testing update', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let generateItem;

  before(() => {
    generateItem = () => createItems({
      count: 1, model, primaryKey: '123', sortKey: 'name', age: 50
    });
  });
  beforeEach(async () => {
    model = buildModel();
    localTable = LocalTable(model);
    await localTable.create();
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing update', async () => {
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.update(item);
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with conditions', async () => {
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.update(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with conditions as array', async () => {
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.update(item, { conditions: [{ attr: 'age', eq: 50 }] });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing update with item not found with conditions', async ({ capture }) => {
    const [item] = await generateItem();
    item.age = 55;
    const error = await capture(() => model.update(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing update with unknown error', async ({ capture }) => {
    const [item] = await generateItem();
    item.age = 55;
    const error = await capture(() => model.update(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing update with item does not exist', async ({ capture }) => {
    const error = await capture(() => model.update({ id: '123', name: 'name', age: 50 }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing update with onNotFound', async () => {
    const logs = [];
    const result = await model.update({ id: '123', name: 'name', age: 50 }, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing update with expectedErrorCodes', async () => {
    const result = await model.update({ id: '123', name: 'name', age: 50 }, {
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });
});
