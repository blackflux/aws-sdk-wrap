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
  let getItemOrNull;
  let generateTable;

  before(() => {
    generateTable = async ({ onCreate, extraAttrs } = {}) => {
      model = buildModel({ onCreate, extraAttrs });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });

  beforeEach(async () => {
    getItemOrNull = (k) => model.getItem(k, {
      onNotFound: (i) => null
    });
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
    await generateTable();
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const result = await model.create(item);
    expect(result).to.deep.equal(
      {
        created: true,
        item
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create with conditions', async () => {
    await generateTable();
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const result = await model.create(item, {
      conditions: { attr: 'age', ne: 1 }
    });
    expect(result).to.deep.equal(
      {
        created: true,
        item
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create with ConditionFailedException', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.create(item, {
      conditions: { attr: 'age', eq: 1 }
    }));
    expect(error.code).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(null);
  });

  it('Testing create with expectedErrorCodes', async () => {
    await generateTable();
    const result = await model.create(item, {
      conditions: { attr: 'age', eq: 1 },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
    expect(await getItemOrNull(key)).to.deep.equal(null);
  });

  it('Testing create itemAlreadyExists error', async ({ capture }) => {
    await generateTable();
    expect(await model.create(item)).to.deep.equal(
      {
        created: true,
        item
      }
    );
    const error = await capture(() => model.create({
      ...key,
      age: 100
    }));
    expect(error).instanceof(ModelAlreadyExists);
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create itemAlreadyExists', async () => {
    await generateTable();
    expect(await model.create(item)).to.deep.equal(
      {
        created: true,
        item
      }
    );
    const logs = [];
    const result = await model.create(
      {
        ...key,
        age: 100
      },
      {
        onAlreadyExists: (k) => {
          logs.push('onAlreadyExists executed');
          return {};
        }
      }
    );
    expect(logs).to.deep.equal(['onAlreadyExists executed']);
    expect(result).to.deep.equal({});
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create with toReturn', async () => {
    await generateTable();
    const result = await model.create(item, { toReturn: ['age'] });
    expect(result).to.deep.equal(
      {
        created: true,
        item: { age: 50 }
      }
    );
  });

  it('Testing create with onCreate', async () => {
    const logs = [];
    const onCreate = (i) => { logs.push(`onCreate executed: ${JSON.stringify(i)}`); };
    await generateTable({ onCreate });
    const result = await model.create(item);
    expect(logs).to.deep.equal(['onCreate executed: {"age":50,"name":"name","id":"123"}']);
    expect(result).to.deep.equal({ created: true, item });
  });

  it('Testing create with a set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const itemWithSet = {
      ...item,
      someSet: ['one', 'two']
    };
    const result = await model.create(itemWithSet);
    expect(result).to.deep.equal(
      {
        created: true,
        item: itemWithSet
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(itemWithSet);
  });

  it('Testing create with an empty set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const itemWithSet = {
      ...item,
      someSet: []
    };
    const result = await model.create(itemWithSet);
    expect(result).to.deep.equal(
      {
        created: true,
        item: itemWithSet
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });
});
