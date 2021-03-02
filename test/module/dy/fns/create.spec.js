const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel } = require('../../../dy-helper');
const { ModelAlreadyExists } = require('../../../../src/resources/errors');

describe('Testing create', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let key;
  let item;

  beforeEach(async () => {
    model = buildModel();
    localTable = LocalTable(model);
    await localTable.create();
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

  it('Testing create', async () => {
    const result = await model.create(item);
    expect(result).to.deep.equal(
      {
        created: true,
        item
      }
    );
    expect(await model.getItem(key)).to.deep.equal(item);
  });

  it('Testing create with conditions', async () => {
    const result = await model.create(item, {
      conditions: { attr: 'age', ne: 1 }
    });
    expect(result).to.deep.equal(
      {
        created: true,
        item
      }
    );
    expect(await model.getItem(key)).to.deep.equal(item);
  });

  it('Testing create with ConditionFailedException', async ({ capture }) => {
    const error = await capture(() => model.create(item, {
      conditions: { attr: 'age', eq: 1 }
    }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
  });

  it('Testing create with expectedErrorCodes', async () => {
    const result = await model.create(item, {
      conditions: { attr: 'age', eq: 1 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing create itemAlreadyExists error', async ({ capture }) => {
    expect(await model.create(item)).to.deep.equal(
      {
        created: true,
        item
      }
    );
    const error = await capture(() => model.create(item));
    expect(error).instanceof(ModelAlreadyExists);
  });

  it('Testing create itemAlreadyExists', async () => {
    expect(await model.create(item)).to.deep.equal(
      {
        created: true,
        item
      }
    );
    const logs = [];
    const result = await model.create(item, {
      onAlreadyExists: (k) => {
        logs.push('onAlreadyExists executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onAlreadyExists executed']);
    expect(result).to.deep.equal({});
  });
});
