import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel } from '../../../dy-helper.js';
import { ModelAlreadyExists } from '../../../../src/resources/errors.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing create', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
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
        modified: true,
        item
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create with null number', async () => {
    await generateTable({
      extraAttrs: {
        num: { type: 'number' }
      }
    });
    const itemWithNullNumber = { ...item, num: null };
    expect(await getItemOrNull(key)).to.deep.equal(null);
    const result = await model.create(itemWithNullNumber);
    expect(result).to.deep.equal(
      {
        created: true,
        modified: true,
        item: itemWithNullNumber
      }
    );
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
        modified: true,
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
    expect(error.name).to.equal('ConditionalCheckFailedException');
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
        modified: true,
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
        modified: true,
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
        modified: true,
        item: { age: 50 }
      }
    );
  });

  it('Testing create with onCreate', async () => {
    const logs = [];
    const onCreate = (i) => {
      logs.push(`onCreate executed: ${JSON.stringify(i)}`);
    };
    await generateTable({ onCreate });
    const result = await model.create(item);
    expect(logs).to.deep.equal(['onCreate executed: {"age":50,"name":"name","id":"123"}']);
    expect(result).to.deep.equal({
      created: true,
      modified: true,
      item
    });
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
        modified: true,
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
        modified: true,
        item: itemWithSet
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(item);
  });

  it('Testing create with validate', async () => {
    const logs = [];
    const validate = (changeset) => {
      logs.push(`validate executed: ${changeset}`);
      return typeof changeset === 'boolean';
    };
    await generateTable({ extraAttrs: { valid: { type: 'boolean', validate } } });
    const itemWithValid = {
      ...item,
      valid: true
    };
    const result = await model.create(itemWithValid);
    expect(result).to.deep.equal(
      {
        created: true,
        modified: true,
        item: itemWithValid
      }
    );
    expect(await getItemOrNull(key)).to.deep.equal(itemWithValid);
    expect(logs).to.deep.equal(['validate executed: true']);
  });

  it('Testing create with validation failure', async ({ capture }) => {
    const validate = (changeset) => false;
    await generateTable({ extraAttrs: { valid: { type: 'boolean', validate } } });
    const itemWithValid = {
      ...item,
      valid: true
    };
    const error = await capture(() => model.create(itemWithValid));
    expect(error.message).to.equal('Validation failure on attribute(s): valid');
    expect(await getItemOrNull(key)).to.deep.equal(null);
  });
});
