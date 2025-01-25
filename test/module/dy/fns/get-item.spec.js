import { expect } from 'chai';
import { describe } from 'node-tdd';
import zlib from 'zlib';
import { LocalTable, buildModel, createItems } from '../../../dy-helper.js';
import { ModelNotFound } from '../../../../src/resources/errors.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing get-item', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let generateItem;
  let generateTable;

  before(() => {
    generateItem = async () => {
      const [item] = await createItems({
        count: 1, model, primaryKey: '123', sortKey: 'name', age: 50
      });
      const key = {
        id: item.id,
        name: item.name
      };
      return { key, item };
    };
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
    const { key, item } = await generateItem();
    const result = await model.getItem(key);
    expect(result).to.deep.equal(item);
  });

  it('Testing getItem throws ModelNotFound error (Query Filter)', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.getItem({ id: '123', name: 'name' }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing getItem onNotFound (Memory Filter)', async ({ capture }) => {
    await generateTable();
    const { key } = await generateItem();
    const r = await model.getItem({ ...key, age: 10 }, {
      onNotFound: (arg1, arg2) => [arg1, arg2]
    });
    expect(r).to.deep.equal([
      { age: 10, name: 'name', id: '123' },
      { error: 'item_attribute_mismatch' }
    ]);
  });

  it('Testing getItem onNotFound (Query Filter)', async () => {
    await generateTable();
    const r = await model.getItem({ id: '123', name: 'name' }, {
      onNotFound: (arg1, arg2) => [arg1, arg2]
    });
    expect(r).to.deep.equal([
      { id: '123', name: 'name' },
      { error: 'item_not_found' }
    ]);
  });

  it('Testing getItem with toReturn', async () => {
    await generateTable();
    const { key } = await generateItem();
    const result = await model.getItem(key, { toReturn: ['name'] });
    expect(result).to.deep.equal({ name: 'name' });
  });

  it('Testing getItem with stubbed defaults', async () => {
    await generateTable();
    const { key } = await generateItem();
    const result = await model.getItem(key, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      age: 30
    });
  });

  it('Testing getItem with default empty set', async () => {
    const def = [];
    await generateTable({ extraAttrs: { ids: { type: 'set', default: def } } });
    const { item } = await model.create({ id: '123', name: 'name', age: 50 });
    const key = { id: item.id, name: item.name };
    const result = await model.getItem(key, { toReturn: ['ids'] });
    expect(result).to.deep.equal({ ids: [] });
    result.ids.push(1, 2, 3);
    expect(def).to.deep.equal([]);
  });

  it('Testing getItem with custom marshalling', async () => {
    await generateTable({
      extraAttrs: {
        bin: {
          type: 'binary',
          default: () => zlib.gzipSync(JSON.stringify([])),
          marshall: (item) => zlib.gzipSync(JSON.stringify(item), { level: 9 }),
          unmarshall: (item) => JSON.parse(zlib.gunzipSync(item))
        }
      }
    });

    const { item } = await model.create({
      id: '123',
      name: 'name',
      age: 50,
      bin: [{ a: 1 }]
    });
    const key = { id: item.id, name: item.name };
    const result = await model.getItem(key, { toReturn: ['bin'] });
    expect(result).to.deep.equal({ bin: [{ a: 1 }] });
  });
});
