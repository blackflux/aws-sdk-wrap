import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel, createItems } from '../../../dy-helper.js';
import { ModelNotFound } from '../../../../src/resources/errors.js';

describe('Testing delete', {
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
    generateTable = async ({ onDelete } = {}) => {
      model = buildModel({ onDelete });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing delete', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.delete(item);
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete throws ModelNotFound error', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.delete({ id: '123', name: 'name' }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing delete with onNotFound', async () => {
    await generateTable();
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
    await generateTable();
    const [item] = await generateItem();
    const result = await model.delete(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({ deleted: true, item });
  });

  it('Testing delete with expectedErrorCodes', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.delete(item, {
      conditions: { attr: 'age', eq: 1 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing delete with unknown error', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.delete({ id: '123', name: 'name' }));
    expect(error.code).to.equal('UnknownError');
  });

  it('Testing delete with toReturn', async () => {
    await generateTable();
    const [item] = await generateItem();
    const result = await model.delete(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      deleted: true,
      item: { age: 50 }
    });
  });

  it('Testing delete with onDelete', async () => {
    const logs = [];
    const onDelete = (i) => { logs.push(`onDelete executed: ${JSON.stringify(i)}`); };
    await generateTable({ onDelete });
    const [item] = await generateItem();
    const result = await model.delete(item);
    expect(logs).to.deep.equal(['onDelete executed: {"age":50,"id":"123","name":"name"}']);
    expect(result).to.deep.equal({ item, deleted: true });
  });
});
