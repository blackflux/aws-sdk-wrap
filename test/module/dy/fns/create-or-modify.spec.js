import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel } from '../../../dy-helper.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing create-or-modify', {
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml',
  timestamp: '2022-03-03T22:00:55.980Z'
}, () => {
  let model;
  let localTable;
  let key;
  let item;
  let primaryKey;
  let getItemOrNull;
  let generateTable;

  before(() => {
    primaryKey = '123';
    getItemOrNull = (k) => model.getItem(k, {
      onNotFound: (i) => null
    });
    generateTable = async ({ onCreate, extraAttrs } = {}) => {
      model = buildModel({ onCreate, extraAttrs });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });

  beforeEach(async () => {
    key = {
      id: '123',
      name: 'name'
    };
    item = {
      ...key,
      age: 50
    };
  });

  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing createOrModify item created', async () => {
    await generateTable();
    expect(await model.createOrModify(item)).to.deep.equal({
      created: true,
      modified: true,
      item
    });
  });

  it('Testing createOrModify with default null', async ({ capture }) => {
    await generateTable({
      extraAttrs: {
        scope: {
          type: 'list',
          default: null
        }
      }
    });
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const r = await model.createOrModify(item);
    expect(r).to.deep.equal({
      created: true,
      modified: true,
      item: {
        age: 50, scope: null, name: 'name', id: '123'
      }
    });
  });

  it('Testing createOrModify with default function', async () => {
    await generateTable({
      extraAttrs: {
        created: {
          type: 'string',
          default: () => new Date().toISOString()
        }
      }
    });
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const result = await model.createOrModify(item);
    const itemWithDefault = {
      ...item,
      created: new Date().toISOString()
    };
    expect(result).to.deep.equal(
      {
        created: true,
        modified: true,
        item: itemWithDefault
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(itemWithDefault);
  });

  it('Testing createOrModify with default', async () => {
    await generateTable();
    delete item.age;
    const itemWithDefault = {
      ...item,
      age: 30
    };
    expect(await model.createOrModify(item)).to.deep.equal({
      created: true,
      modified: true,
      item: itemWithDefault
    });
    const result = await model.getItem(item);
    expect(result).to.deep.equal(itemWithDefault);
  });

  it('Testing createOrModify item updated', async () => {
    await generateTable();
    expect(await model.createOrModify(item)).to.deep.equal({
      created: true,
      modified: true,
      item
    });
    item.age = 51;
    expect(await model.createOrModify(item)).to.deep.equal({
      created: false,
      modified: true,
      item
    });
  });

  it('Testing createOrModify with conditions', async () => {
    await generateTable();
    const result = await model.createOrModify(item, { conditions: { attr: 'name', exists: false } });
    expect(result).to.deep.equal({
      created: true,
      modified: true,
      item
    });
  });

  it('Testing createOrModify with ConditionalCheckFailedException', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.createOrModify(item, { conditions: { attr: 'name', exists: true } }));
    expect(error.name).to.equal('ConditionalCheckFailedException');
  });

  it('Testing createOrModify with expectedErrorCodes', async () => {
    await generateTable();
    const result = await model.createOrModify(item, {
      conditions: { attr: 'name', exists: true },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing createOrModify with undefined attribute', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.createOrModify({
      id: primaryKey,
      name: 'name',
      age: undefined
    }));
    expect(error.message).to.equal('Attributes cannot be undefined: age');
  });

  it('Testing createOrModify wrong attribute type', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.createOrModify({
      id: primaryKey,
      name: 'name',
      age: 'number'
    }));
    expect(error.message).to.equal('Could not convert \'number\' to a number for \'age\'');
  });

  it('Testing createOrModify with toReturn', async () => {
    await generateTable();
    expect(await model.createOrModify(item, { toReturn: ['age'] })).to.deep.equal({
      created: true,
      modified: true,
      item: { age: 50 }
    });
  });
});
