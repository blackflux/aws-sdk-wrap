const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel, createItems } = require('../../../dy-helper');
const { ModelNotFound } = require('../../../../src/resources/errors');

describe('Testing delete', {
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

  it('Testing delete', async () => {
    const [item] = await generateItem();
    const result = await model.delete(item);
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete throws ModelNotFound error', async ({ capture }) => {
    const error = await capture(() => model.delete({ id: '123', name: 'name' }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing delete with onNotFound', async () => {
    const logs = [];
    const result = await model.delete({ id: '123', name: 'name' }, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing delete with conditions', async () => {
    const [item] = await generateItem();
    const result = await model.delete(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete with expectedErrorCodes', async () => {
    const [item] = await generateItem();
    const result = await model.delete(item, {
      conditions: { attr: 'age', eq: 1 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing delete with unknown error', async ({ capture }) => {
    const error = await capture(() => model.delete({ id: '123', name: 'name' }));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing delete with toReturn', async () => {
    const [item] = await generateItem();
    const result = await model.delete(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      deleted: true,
      item: { age: 50 }
    });
  });
});
