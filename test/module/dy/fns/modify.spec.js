import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel, createItems } from '../../../dy-helper.js';
import { ModelNotFound } from '../../../../src/resources/errors.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing modify', {
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
    generateItem = async ({ extraAttrs } = {}) => {
      const [item] = await createItems({
        count: 1, model, primaryKey: '123', sortKey: 'name', age: 50, extraAttrs
      });
      const key = { id: item.id, name: item.name };
      return { key, item };
    };
    generateTable = async ({ onUpdate, extraAttrs } = {}) => {
      model = buildModel({ onUpdate, extraAttrs });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing modify', async () => {
    await generateTable();
    const { item } = await generateItem();
    item.age = 55;
    const result = await model.modify(item);
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item
    });
  });

  it('Testing modify no changes', async () => {
    await generateTable();
    const { item } = await generateItem();
    const result = await model.modify(item);
    expect(result).to.deep.equal({
      created: false,
      modified: false,
      item
    });
  });

  it('Testing modify with conditions', async () => {
    await generateTable();
    const { item } = await generateItem();
    item.age = 55;
    const result = await model.modify(item, { conditions: { attr: 'age', eq: 50 } });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item
    });
  });

  it('Testing modify with conditions as array', async () => {
    await generateTable();
    const { item } = await generateItem();
    item.age = 55;
    const result = await model.modify(item, { conditions: [{ attr: 'age', eq: 50 }] });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item
    });
  });

  it('Testing modify with item not found with conditions', async ({ capture }) => {
    await generateTable();
    const { item } = await generateItem();
    item.age = 55;
    const error = await capture(() => model.modify(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.name).to.equal('ConditionalCheckFailedException');
  });

  it('Testing modify with unknown error', async ({ capture }) => {
    await generateTable();
    const { item } = await generateItem();
    item.age = 55;
    const error = await capture(() => model.modify(item, { conditions: { attr: 'age', eq: 10 } }));
    expect(error.name).to.equal('SyntaxError');
  });

  it('Testing modify with item does not exist', async ({ capture }) => {
    await generateTable();
    const error = await capture(() => model.modify({ id: '123', name: 'name', age: 50 }));
    expect(error).instanceof(ModelNotFound);
  });

  it('Testing modify with onNotFound', async () => {
    await generateTable();
    const logs = [];
    const result = await model.modify({ id: '123', name: 'name', age: 50 }, {
      onNotFound: (key) => {
        logs.push('onNotFound executed');
        return {};
      }
    });
    expect(logs).to.deep.equal(['onNotFound executed']);
    expect(result).to.deep.equal({});
  });

  it('Testing modify with expectedErrorCodes', async () => {
    await generateTable();
    const result = await model.modify({ id: '123', name: 'name', age: 50 }, {
      expectedErrorCodes: ['ConditionalCheckFailedException']
    });
    expect(result).to.equal('ConditionalCheckFailedException');
  });

  it('Testing modify with toReturn', async () => {
    await generateTable();
    const { item } = await generateItem();
    const age = 55;
    item.age = age;
    const result = await model.modify(item, { toReturn: ['age'] });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: { age }
    });
  });

  it('Testing modify with onUpdate', async () => {
    const logs = [];
    const onUpdate = (i) => {
      logs.push(`onUpdate executed: ${JSON.stringify(i)}`);
    };
    await generateTable({ onUpdate });
    const { item } = await generateItem();
    item.age = 55;
    const result = await model.modify(item);
    expect(logs).to.deep.equal(['onUpdate executed: {"age":55,"id":"123","name":"name"}']);
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item
    });
  });

  it('Testing modify with an empty set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one', 'two'] } });
    const updatedItem = {
      ...item,
      someSet: []
    };
    const result = await model.modify(updatedItem);
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: updatedItem
    });
    expect(await model.getItem(key)).to.deep.equal({
      id: item.id,
      name: item.name,
      age: item.age
    });
  });

  it('Testing modify replace set entries', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one', 'two'] } });
    const updatedItem = {
      ...item,
      someSet: ['three', 'four']
    };
    const result = await model.modify(updatedItem);
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: updatedItem
    });
    expect(await model.getItem(key)).to.deep.equal({
      id: item.id,
      name: item.name,
      age: item.age,
      someSet: ['four', 'three']
    });
  });

  it('Testing modify add entry to set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one', 'two'] } });
    const result = await model.modify({
      ...item,
      someSet: { $add: ['three'] }
    });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: {
        ...item,
        someSet: ['one', 'two', 'three']
      }
    });
    expect(await model.getItem(key)).to.deep.equal({
      id: item.id,
      name: item.name,
      age: item.age,
      someSet: ['one', 'three', 'two']
    });
  });

  it('Testing modify add entry to new set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem();
    const result = await model.modify({
      ...item,
      someSet: { $add: ['one'] }
    });
    const resultItem = {
      ...item,
      someSet: ['one']
    };
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: resultItem
    });
    expect(await model.getItem(key)).to.deep.equal(resultItem);
  });

  it('Testing modify remove entry from set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one', 'two'] } });
    const result = await model.modify({
      id: item.id,
      name: item.name,
      someSet: { $delete: ['two'] }
    });
    const resultItem = {
      ...item,
      someSet: ['one']
    };
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: resultItem
    });
    expect(await model.getItem(key)).to.deep.equal(resultItem);
  });

  it('Testing modify with remove', async () => {
    await generateTable();
    const { key, item } = await generateItem({ extraAttrs: { slug: 'some-slug' } });
    const result = await model.modify({
      id: item.id,
      name: item.name,
      $remove: ['slug']
    });
    const resultItem = {
      id: item.id,
      name: item.name,
      age: item.age
    };
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: resultItem
    });
    expect(await model.getItem(key)).to.deep.equal(resultItem);
  });

  it('Testing modify with an empty set and remove', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one', 'two'] } });
    const updatedItem = {
      ...item,
      someSet: []
    };
    const result = await model.modify({
      ...updatedItem,
      $remove: ['slug']
    });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: updatedItem
    });
    expect(await model.getItem(key)).to.deep.equal({
      id: item.id,
      name: item.name,
      age: item.age
    });
  });

  it('Testing modify with an object with $delete and $add', async () => {
    await generateTable({ extraAttrs: { someObject: { type: 'map' } } });
    const { key, item } = await generateItem({
      extraAttrs: {
        someObject: {
          $add: ['a'],
          $delete: ['b']
        }
      }
    });
    const updatedItem = {
      ...item,
      someObject: {
        $add: ['y'],
        $delete: ['z']
      }
    };
    const result = await model.modify(updatedItem);
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: updatedItem
    });
    expect(await model.getItem(key)).to.deep.equal(updatedItem);
  });

  it('Testing modify add existing entry to set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one'] } });
    const result = await model.modify({
      ...item,
      someSet: { $add: ['one'] }
    });
    const resultItem = {
      ...item,
      someSet: ['one']
    };
    expect(result).to.deep.equal({
      created: false,
      modified: false,
      item: resultItem
    });
    expect(await model.getItem(key)).to.deep.equal(resultItem);
  });

  it('Testing modify delete nonexistent entry from set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem({ extraAttrs: { someSet: ['one'] } });
    const result = await model.modify({
      ...item,
      someSet: { $delete: ['two'] }
    });
    const resultItem = {
      ...item,
      someSet: ['one']
    };
    expect(result).to.deep.equal({
      created: false,
      modified: false,
      item: resultItem
    });
    expect(await model.getItem(key)).to.deep.equal(resultItem);
  });

  it('Testing modify delete from empty set', async () => {
    await generateTable({ extraAttrs: { someSet: { type: 'set' } } });
    const { key, item } = await generateItem();
    const result = await model.modify({
      ...item,
      someSet: { $delete: ['one'] }
    });
    expect(result).to.deep.equal({
      created: false,
      modified: false,
      item
    });
    expect(await model.getItem(key)).to.deep.equal(item);
  });

  it('Testing modify with number and $add', async () => {
    await generateTable();
    const { key, item } = await generateItem();
    const expectedItem = {
      ...item,
      age: item.age + 1
    };
    const result = await model.modify({
      ...item,
      age: { $add: 1 }
    });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: expectedItem
    });
    expect(await model.getItem(key)).to.deep.equal(expectedItem);
  });

  it('Testing modify with empty number and $add', async () => {
    await generateTable({ extraAttrs: { someNumber: { type: 'number' } } });
    const { key, item } = await generateItem();
    const expectedItem = {
      ...item,
      someNumber: 1
    };
    const result = await model.modify({
      ...item,
      someNumber: { $add: 1 }
    });
    expect(result).to.deep.equal({
      created: false,
      modified: true,
      item: expectedItem
    });
    expect(await model.getItem(key)).to.deep.equal(expectedItem);
  });
});
