import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel, createItems } from '../../../dy-helper.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing scan', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let generateItems;

  before(() => {
    generateItems = ({ count, age = null }) => createItems({
      count,
      model,
      primaryKey: '123',
      sortKey: 'name',
      age: age === null ? 50 : age
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

  it('Testing scan', async () => {
    const [item] = await generateItems({ count: 1 });
    const result = await model.scan();
    expect(result).to.deep.equal({
      items: [item]
    });
  });

  it('Testing scan with toReturn', async () => {
    const [item] = await generateItems({ count: 1 });
    const result = await model.scan({ toReturn: ['name'] });
    expect(result).to.deep.equal({
      items: [{ name: item.name }]
    });
  });

  it('Testing scan with index', async () => {
    const [item] = await generateItems({ count: 1 });
    const result = await model.scan({
      index: 'targetIndex',
      consistent: false
    });
    expect(result).to.deep.equal({
      items: [item]
    });
  });

  it('Testing scan with lastEvaluatedKey', async () => {
    const [item1, item2, item3] = await generateItems({ count: 3 });
    const limit = 2;
    const result1 = await model.scan({ limit });
    expect(result1).to.deep.equal({
      items: [item1, item2],
      lastEvaluatedKey: {
        id: '123',
        name: 'name-2'
      }
    });
    const result2 = await model.scan({
      limit,
      lastEvaluatedKey: result1.lastEvaluatedKey
    });
    expect(result2).to.deep.equal({
      items: [item3]
    });
  });

  it('Testing scan with limit not reached', async () => {
    const [item] = await generateItems({ count: 1 });
    const result = await model.scan({ limit: 2 });
    expect(result).to.deep.equal({
      items: [item]
    });
  });

  it('Testing scan with limit of 1', async () => {
    const [item] = await generateItems({ count: 3 });
    const result = await model.scan({ limit: 1 });
    expect(result).to.deep.equal({
      items: [item],
      lastEvaluatedKey: {
        id: '123',
        name: 'name'
      }
    });
  });

  it('Testing scan with limit of 4', async () => {
    const [firstItem, secondItem, thirdItem] = await generateItems({ count: 3 });
    const result = await model.scan({ limit: 4 });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem]
    });
  });

  it('Testing scan with filters', async () => {
    const [firstItem, secondItem] = await generateItems({
      count: 3,
      age: [10, 20, 30]
    });
    const result = await model.scan({
      filters: { attr: 'age', lte: 20 }
    });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem]
    });
  });

  it('Testing scan with filters no result', async () => {
    await generateItems({ count: 3 });
    const result = await model.scan({
      filters: { attr: 'age', eq: 0 }
    });
    expect(result).to.deep.equal({
      items: []
    });
  });

  it('Testing scan on invalid index', async ({ capture }) => {
    const error = await capture(() => model.scan({ index: 'invalid' }));
    expect(error.message).to.equal('Invalid index provided: invalid');
  });
});
