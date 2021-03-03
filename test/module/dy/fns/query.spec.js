const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel, createItems } = require('../../../dy-helper');

describe('Testing query', {
  useNock: true,
  nockStripHeaders: true,
  envVarsFile: '../../../default.env.yml'
}, () => {
  let model;
  let localTable;
  let primaryKey;
  let generateItem;
  let setupThreeItems;
  let setupThreeItemsWithMultipleAges;

  before(() => {
    primaryKey = '123';
    generateItem = () => createItems({
      count: 1, model, primaryKey, sortKey: 'name', age: 50
    });
    setupThreeItems = async () => createItems({
      count: 3, model, primaryKey, sortKey: 'name', age: 50
    });
    setupThreeItemsWithMultipleAges = async () => createItems({
      count: 3, model, primaryKey, sortKey: 'name', age: [10, 20, 30]
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

  it('Testing query', async () => {
    const [item] = await generateItem();
    const result = await model.query(primaryKey);
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with limit', async () => {
    const [item] = await generateItem();
    const item2 = {
      id: primaryKey,
      name: 'name-2',
      age: 25
    };
    expect(await model.createOrModify(item2)).to.deep.equal({
      created: true,
      item: item2
    });
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: {
          limit: 1,
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZSIsImlkIjoiMTIzIn0sImN1cnJlbnRQYWdlIjoyfQ=='
        },
        index: { current: 1 },
        size: 1
      }
    });
  });

  it('Testing query with toReturn', async () => {
    await generateItem();
    const result = await model.query(primaryKey, { toReturn: ['name'] });
    expect(result).to.deep.equal({
      items: [{ name: 'name' }],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with index', async () => {
    const [item] = await generateItem();
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with conditions', async () => {
    const [item] = await generateItem();
    const result = await model.query(primaryKey, {
      conditions: { attr: 'name', eq: 'name' }
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with conditions sortKey unknown', async () => {
    await generateItem();
    const result = await model.query(primaryKey, {
      conditions: { attr: 'name', eq: 'unknown' }
    });
    expect(result).to.deep.equal({
      items: [],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query on secondary index with conditions', async () => {
    const [item] = await generateItem();
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false,
      conditions: { attr: 'name', eq: 'name' }
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query on invalid index', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, { index: 'invalid' }));
    expect(error.message).to.equal('Invalid index provided: invalid');
  });

  it('Testing query with invalid conditions', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      conditions: { attr: 'name', invalid: 'name' }
    }));
    expect(error.message).to.have.string('Invalid conditions provided');
  });

  it('Testing query with bad sortKey name', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      conditions: { attr: 'invalid', eq: 'name' }
    }));
    expect(error.message).to.have.string('Expected conditions.attr to be "name"');
  });

  it('Testing query on index without sortKey', async ({ capture }) => {
    const error = await capture(() => model.query(primaryKey, {
      index: 'idIndex',
      conditions: { attr: 'invalid', eq: 'name' }
    }));
    expect(error.message).to.equal('No sortKey present on index');
  });

  it('Testing query with cursor', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const firstResult = await model.query(primaryKey, { limit: 2 });
    expect(firstResult).to.deep.equal({
      items: [firstItem, secondItem],
      page: {
        next: {
          limit: 2,
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZS0yIiwiaWQiOiIxMjMifSwiY3VycmVudFBhZ2UiOjJ9'
        },
        index: { current: 1 },
        size: 2
      }
    });
    const secondResult = await model.query(primaryKey, { cursor: firstResult.page.next.cursor });
    expect(secondResult).to.deep.equal({
      items: [thirdItem],
      page: {
        next: null,
        index: { current: 2 },
        size: 2
      }
    });
  });

  it('Testing query exhaustive pagination with limit null', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: null });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: null
      }
    });
  });

  it('Testing query exhaustive pagination with limit not reached', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 3 });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 3
      }
    });
  });

  it('Testing query with limit of 1', async () => {
    const [firstItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      items: [firstItem],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZSIsImlkIjoiMTIzIn0sImN1cnJlbnRQYWdlIjoyfQ==',
          limit: 1
        },
        index: { current: 1 },
        size: 1
      }
    });
  });

  it('Testing query with limit of 4', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result = await model.query(primaryKey, { limit: 4 });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 4
      }
    });
  });

  it('Testing query with filters', async () => {
    const [firstItem, secondItem] = await setupThreeItemsWithMultipleAges();
    const result = await model.query(primaryKey, {
      filters: { attr: 'age', lte: 20 }
    });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with filters with pagination', async () => {
    const filters = { attr: 'age', lte: 50 };
    const [firstItem, secondItem, thirdItem] = await setupThreeItemsWithMultipleAges();
    const firstResult = await model.query(primaryKey, { limit: 2, filters });
    expect(firstResult).to.deep.equal({
      items: [firstItem, secondItem],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwibGFzdEV2YWx1YXRlZEtleSI6eyJuYW1lIjoibmFtZS0yIiwiaWQiOiIxMjMifSwiY3VycmVudFBhZ2UiOjJ9',
          limit: 2
        },
        index: { current: 1 },
        size: 2
      }
    });
    const secondResult = await model.query(primaryKey, {
      filters,
      cursor: firstResult.page.next.cursor
    });
    expect(secondResult).to.deep.equal({
      items: [thirdItem],
      page: {
        next: null,
        index: { current: 2 },
        size: 2
      }
    });
  });

  it('Testing query with filters with conditions', async () => {
    const [firstItem] = await setupThreeItemsWithMultipleAges();
    const result = await model.query(primaryKey, {
      conditions: { attr: 'name', eq: firstItem.name },
      filters: { attr: 'age', eq: 10 }
    });
    expect(result).to.deep.equal({
      items: [firstItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with filters on secondary index', async () => {
    const [firstItem, secondItem] = await setupThreeItemsWithMultipleAges();
    const result = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false,
      filters: { attr: 'age', lte: 20 }
    });
    expect(result).to.deep.equal({
      items: [firstItem, secondItem],
      page: {
        next: null,
        index: { current: 1 },
        size: 20
      }
    });
  });
});
