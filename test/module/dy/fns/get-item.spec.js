const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel, createItems } = require('../../../dy-helper');
const { ModelNotFound } = require('../../../../src/resources/errors');

describe('Testing get-item', {
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
    generateTable = async ({ extraAttrs } = {}) => {
      model = buildModel({ extraAttrs });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing getItem', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.getItem(item);
    expect(result).to.deep.equal(item);
  });

  it('Testing getItem throws ModelNotFound error', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.getItem({ id: '123', name: 'name' }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing getItem onNotFound', async () => {
    await generateTable();
    const logs = [];
    const result = await model.getItem({ id: '123', name: 'name' }, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing getItem with toReturn', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.getItem(item, { toReturn: ['name'] });
    expect(result).to.deep.equal({ name: 'name' });
  });

  it('Testing getItem with stubbed defaults', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.getItem(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      age: 30
    });
  });

  it('Testing getItem with default empty set', async () => {
    await generateTable({ extraAttrs: { ids: { type: 'set', default: [] } } });
    const { item } = await model.create({ id: '123', name: 'name', age: 50 });
    const result = await model.getItem(item, { toReturn: ['ids'] });
    expect(result).to.deep.equal({
      ids: []
    });
  });
});
