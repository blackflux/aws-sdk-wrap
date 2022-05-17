import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel } from '../../../dy-helper.js';
import { ModelNotFound } from '../../../../src/resources/errors.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing replace', {
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

  it('Testing replace item replaced', async () => {
    expect(await generateItem()).to.deep.equal({ created: true, item });
    const newItem = { ...key, age: 100 };
    expect(await model.replace(newItem)).to.deep.equal({ created: false, item: newItem });
    expect(await getItemOrNull(key)).to.deep.equal(newItem);
  });

  it('Testing replace with conditions', async () => {
    expect(await generateItem()).to.deep.equal({ created: true, item });
    const newItem = { ...key, age: 100 };
    const result = await model.replace(newItem, {
      conditions: { attr: 'age', eq: 50 }
    });
    expect(result).to.deep.equal({ created: false, item: newItem });
    expect(await getItemOrNull(key)).to.deep.equal(newItem);
  });

  it('Testing replace with ConditionFailedException', async ({ capture }) => {
    expect(await generateItem()).to.deep.equal({ created: true, item });
    const newItem = { ...key, age: 100 };
    const error = await capture(() => model.replace(newItem, {
      conditions: { attr: 'age', eq: 10 }
    }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing replace with expectedErrorCodes', async () => {
    expect(await generateItem()).to.deep.equal({ created: true, item });
    const newItem = { ...key, age: 100 };
    const result = await model.replace(newItem, {
      conditions: { attr: 'age', eq: 10 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing replace with onNotFound error', async ({ capture }) => {
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const error = await capture(() => model.replace(item));
    expect(error).instanceof(ModelNotFound);
    expect(await getItemOrNull(key)).to.deep.equal(null);
  });

  it('Testing replace with onNotFound', async () => {
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const logs = [];
    const result = await model.replace(item, {
      onNotFound: (k) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
    expect(await getItemOrNull(key)).to.deep.equal(null);
  });

  it('Testing replace with toReturn', async () => {
    expect(await generateItem()).to.deep.equal({ created: true, item });
    const newItem = { ...key, age: 100 };
    expect(await model.replace(newItem, { toReturn: ['age'] })).to.deep.equal({
      created: false,
      item: { age: 100 }
    });
  });
});
