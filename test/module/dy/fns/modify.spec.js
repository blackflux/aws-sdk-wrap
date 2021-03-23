const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel, createItems } = require('../../../dy-helper');
const { ModelNotFound } = require('../../../../src/resources/errors');

describe('Testing modify', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let generateItem;
  let generateTable;

  before(() => {
    generateItem = () => createItems({
      count: 1, model, primaryKey: '123', sortKey: 'name', age: 50
    });
    generateTable = async ({ onUpdate } = {}) => {
      model = buildModel({ onUpdate });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing modify', async () => {
    await generateTable();
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.modify(item);
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing modify with conditions', async () => {
    await generateTable();
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.modify(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing modify with conditions as array', async () => {
    await generateTable();
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.modify(item, { conditions: [{ attr: 'age', eq: 50 }] });
    expect(result).to.deep.equal({ created: false, item });
  });

  it('Testing modify with item not found with conditions', async ({ capture }) => {
    await generateTable();
    const [item] = await generateItem();
    item.age = 55;
    const error = await capture(() => model.modify(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing modify with unknown error', async ({ capture }) => {
    await generateTable();
    const [item] = await generateItem();
    item.age = 55;
    const error = await capture(() => model.modify(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing modify with item does not exist', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.modify({ id: '123', name: 'name', age: 50 }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing modify with onNotFound', async () => {
    await generateTable();
    const logs = [];
    const result = await model.modify({ id: '123', name: 'name', age: 50 }, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing modify with expectedErrorCodes', async () => {
    await generateTable();
    const result = await model.modify({ id: '123', name: 'name', age: 50 }, {
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing modify with toReturn', async () => {
    await generateTable();
    const [item] = await generateItem();
    const age = 55;
    item.age = age;
    const result = await model.modify(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({ created: false, item: { age } });
  });

  it('Testing modify with onUpdate', async () => {
    const logs = [];
    const onUpdate = (i) => { logs.push(`onUpdate executed: ${JSON.stringify(i)}`); };
    await generateTable({ onUpdate });
    const [item] = await generateItem();
    item.age = 55;
    const result = await model.modify(item);
    expect(logs).to.deep.equal(['onUpdate executed: {"age":55,"name":"name","id":"123"}']);
    expect(result).to.deep.equal({ created: false, item });
  });
});
