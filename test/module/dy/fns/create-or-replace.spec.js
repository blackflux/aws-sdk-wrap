import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel } from '../../../dy-helper.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing create-or-replace', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let item;
  let key;
  let getItemOrNull;
  let generateItem;

  before(() => {
    key = {
      id: '123',
      name: 'name'
    };
  });
  beforeEach(async () => {
    model = buildModel();
    localTable = LocalTable(model);
    await localTable.create();
    item = {
      ...key,
      slug: 'slug',
      age: 50
    };
    getItemOrNull = (k) => model.getItem(k, {
      onNotFound: (i) => null
    });
    generateItem = () => model.create(item);
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing createOrReplace item created', async () => {
    expect(await getItemOrNull(key)).to.deep.equal(null);
    expect(await model.createOrReplace(item)).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing createOrReplace item replaced', async () => {
    expect(await generateItem()).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    expect(await getItemOrNull(key)).to.deep.equal(item);
    const newItem = { ...key, age: 20 };
    expect(await model.createOrReplace(newItem)).to.deep.equal({
      created: false,
      modified: true,
      item: newItem
    });
    expect(await getItemOrNull(key)).to.deep.equal(newItem);
  });

  it('Testing createOrReplace with conditions', async () => {
    expect(await generateItem()).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    const newItem = { ...key, age: 20 };
    const result = await model.createOrReplace(newItem, {
      conditions: { attr: 'age', eq: 50 }
    });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: newItem
    });
    expect(await getItemOrNull(key)).to.deep.equal(newItem);
  });

  it('Testing createOrReplace with ConditionalCheckFailedException', async ({ capture }) => {
    expect(await generateItem()).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    const newItem = { ...key, age: 100 };
    const error = await capture(() => model.createOrReplace(newItem, {
      conditions: { attr: 'age', eq: 10 }
    }));
    expect(error.name).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing createOrReplace with expectedErrorCodes', async () => {
    expect(await generateItem()).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    const newItem = { ...key, age: 100 };
    const result = await model.createOrReplace(newItem, {
      conditions: { attr: 'age', eq: 10 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing createOrReplace with toReturn', async () => {
    expect(await model.createOrReplace(item, { toReturn: ['age'] })).to.deep.equal({
      created: true,
      modified: true,
      item: { age: 50 }
    });
  });
});
