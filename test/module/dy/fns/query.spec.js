import { expect } from 'chai';
import { describe } from 'node-tdd';
import {
  LocalTable,
  buildModel,
  createItems,
  deleteItem
} from '../../../dy-helper.js';
import nockReqHeaderOverwrite from '../../../req-header-overwrite.js';

describe('Testing query', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
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
        previous: null,
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
      modified: true,
      item: item2
    });
    const result = await model.query(primaryKey, { limit: 1 });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZSJ9LCJjdXJyZW50UGFnZSI6MiwidHlwZSI6Im5leHQifQ=='
        },
        previous: null,
        index: { current: 1 },
        size: 1
      }
    });
  });

  it('Testing query with cursor fields missing', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItemsWithMultipleAges();
    const result1 = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false,
      limit: 2,
      toReturn: ['age']
    });
    expect(result1).to.deep.equal({
      items: [{ age: firstItem.age }, { age: secondItem.age }],
      page: {
        previous: null,
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0yIn0sImN1cnJlbnRQYWdlIjoyLCJ0eXBlIjoibmV4dCJ9'
        },
        index: { current: 1 },
        size: 2
      }
    });
    const result2 = await model.query(primaryKey, {
      index: 'targetIndex',
      consistent: false,
      limit: 2,
      toReturn: ['age'],
      cursor: result1.page.next.cursor
    });
    expect(result2).to.deep.equal({
      items: [{ age: thirdItem.age }],
      page: {
        previous: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0zIn0sImN1cnJlbnRQYWdlIjoxLCJ0eXBlIjoicHJldmlvdXMifQ=='
        },
        next: null,
        index: { current: 2 },
        size: 2
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
        previous: null,
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
        previous: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with index number as primaryKey', async () => {
    const [item] = await generateItem();
    const result = await model.query(50, {
      index: 'ageIndex',
      consistent: false
    });
    expect(result).to.deep.equal({
      items: [item],
      page: {
        next: null,
        previous: null,
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
        previous: null,
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
        previous: null,
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
        previous: null,
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
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0yIn0sImN1cnJlbnRQYWdlIjoyLCJ0eXBlIjoibmV4dCJ9'
        },
        previous: null,
        index: { current: 1 },
        size: 2
      }
    });
    const secondResult = await model.query(primaryKey, { cursor: firstResult.page.next.cursor });
    expect(secondResult).to.deep.equal({
      items: [thirdItem],
      page: {
        next: null,
        previous: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0zIn0sImN1cnJlbnRQYWdlIjoxLCJ0eXBlIjoicHJldmlvdXMifQ=='
        },
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
        previous: null,
        index: { current: 1 },
        size: null
      }
    });
  });

  it('Testing query exhaustive pagination with limit not reached', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const result1 = await model.query(primaryKey, { limit: 3 });
    expect(result1).to.deep.equal({
      items: [firstItem, secondItem, thirdItem],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Mywic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0zIn0sImN1cnJlbnRQYWdlIjoyLCJ0eXBlIjoibmV4dCJ9'
        },
        previous: null,
        index: { current: 1 },
        size: 3
      }
    });
    const { cursor } = result1.page.next;
    const result2 = await model.query(primaryKey, { cursor });
    expect(result2).to.deep.equal({
      items: [],
      page: {
        next: null,
        previous: {
          cursor: 'eyJsaW1pdCI6Mywic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiY3VycmVudFBhZ2UiOjEsInR5cGUiOiJwcmV2aW91cyJ9'
        },
        index: { current: 2 },
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
          cursor: 'eyJsaW1pdCI6MSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZSJ9LCJjdXJyZW50UGFnZSI6MiwidHlwZSI6Im5leHQifQ=='
        },
        previous: null,
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
        previous: null,
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
        previous: null,
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
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0yIn0sImN1cnJlbnRQYWdlIjoyLCJ0eXBlIjoibmV4dCJ9'
        },
        previous: null,
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
        previous: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0zIn0sImN1cnJlbnRQYWdlIjoxLCJ0eXBlIjoicHJldmlvdXMifQ=='
        },
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
        previous: null,
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
        previous: null,
        index: { current: 1 },
        size: 20
      }
    });
  });

  it('Testing query with scanIndexForward', async () => {
    const [firstItem, secondItem, thirdItem] = await setupThreeItems();
    const firstResult = await model.query(primaryKey, {
      scanIndexForward: false,
      limit: 2
    });
    expect(firstResult).to.deep.equal({
      items: [thirdItem, secondItem],
      page: {
        next: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6ZmFsc2UsImV4Y2x1c2l2ZVN0YXJ0S2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUtMiJ9LCJjdXJyZW50UGFnZSI6MiwidHlwZSI6Im5leHQifQ=='
        },
        previous: null,
        index: { current: 1 },
        size: 2
      }
    });
    const secondResult = await model.query(primaryKey, {
      cursor: firstResult.page.next.cursor
    });
    expect(secondResult).to.deep.equal({
      items: [firstItem],
      page: {
        next: null,
        previous: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6ZmFsc2UsImV4Y2x1c2l2ZVN0YXJ0S2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUifSwiY3VycmVudFBhZ2UiOjEsInR5cGUiOiJwcmV2aW91cyJ9'
        },
        index: { current: 2 },
        size: 2
      }
    });
    const thirdResult = await model.query(primaryKey, {
      cursor: firstResult.page.next.cursor,
      scanIndexForward: true
    });
    expect(thirdResult).to.deep.equal({
      items: [thirdItem],
      page: {
        next: null,
        previous: {
          // eslint-disable-next-line max-len
          cursor: 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiZXhjbHVzaXZlU3RhcnRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZS0zIn0sImN1cnJlbnRQYWdlIjoxLCJ0eXBlIjoicHJldmlvdXMifQ=='
        },
        index: { current: 2 },
        size: 2
      }
    });
  });

  describe('Testing paging back and forth', () => {
    let validate;
    let query;
    beforeEach(() => {
      validate = (result, item, hasPrev, hasNext, page) => {
        if (Array.isArray(item)) {
          expect(result.items).to.deep.equal(item);
        } else {
          expect(result.items).to.deep.equal(item === null ? [] : [item]);
        }
        const cursorNext = result?.page?.next?.cursor;
        const cursorPrevious = result?.page?.previous?.cursor;
        expect(result?.page?.index.current).to.equal(page);
        expect(typeof cursorNext).to.equal(hasNext ? 'string' : 'undefined');
        expect(typeof cursorPrevious).to.equal(hasPrev ? 'string' : 'undefined');
      };
      query = async (result, forward) => {
        const cursorNext = result?.page?.next?.cursor;
        const cursorPrevious = result?.page?.previous?.cursor;
        return model.query(primaryKey, { cursor: forward ? cursorNext : cursorPrevious });
      };
    });

    it('Testing single item per page, forward', async () => {
      const [item1, item2, item3] = await setupThreeItems();

      const r1 = await model.query(primaryKey, { limit: 1 });
      await validate(r1, item1, false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, item2, true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, item3, true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      const r5 = await query(r4, false);
      await validate(r5, item3, true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, item2, true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, item1, false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, item2, true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, item3, true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);

      expect(r1).to.deep.equal(r7);
      expect(r2).to.deep.equal(r8);
      expect(r3).to.deep.equal(r9);
      expect(r4).to.deep.equal(r10);
      expect(r5).to.deep.equal(r3);
      expect(r6).to.deep.equal(r2);
    });

    it('Testing single item per page, backwards', async () => {
      const [item1, item2, item3] = await setupThreeItems();

      const r1 = await model.query(primaryKey, { limit: 1, scanIndexForward: false });
      await validate(r1, item3, false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, item2, true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, item1, true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      const r5 = await query(r4, false);
      await validate(r5, item1, true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, item2, true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, item3, false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, item2, true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, item1, true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);

      expect(r1).to.deep.equal(r7);
      expect(r2).to.deep.equal(r8);
      expect(r3).to.deep.equal(r9);
      expect(r4).to.deep.equal(r10);
      expect(r5).to.deep.equal(r3);
      expect(r6).to.deep.equal(r2);
    });

    it('Testing two items per page, five total, forward', async () => {
      const [item1, item2, item3, item4, item5] = await createItems({
        count: 5, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2 });
      await validate(r1, [item1, item2], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item4], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item5], true, false, 3);
      const r4 = await query(r3, false);
      await validate(r4, [item3, item4], true, true, 2);
      const r5 = await query(r4, false);
      await validate(r5, [item1, item2], false, true, 1);
      const r6 = await query(r5, true);
      await validate(r6, [item3, item4], true, true, 2);
      const r7 = await query(r6, true);
      await validate(r7, item5, true, false, 3);

      expect(r1).to.deep.equal(r5);
      expect(r2).to.deep.equal(r6);
      expect(r3).to.deep.equal(r7);
      expect(r4).to.deep.equal(r6);
    });

    it('Testing two items per page, five total, backwards', async () => {
      const [item1, item2, item3, item4, item5] = await createItems({
        count: 5, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2, scanIndexForward: false });
      await validate(r1, [item5, item4], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item2], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item1], true, false, 3);
      const r4 = await query(r3, false);
      await validate(r4, [item3, item2], true, true, 2);
      const r5 = await query(r4, false);
      await validate(r5, [item5, item4], false, true, 1);
      const r6 = await query(r5, true);
      await validate(r6, [item3, item2], true, true, 2);
      const r7 = await query(r6, true);
      await validate(r7, item1, true, false, 3);

      expect(r1).to.deep.equal(r5);
      expect(r2).to.deep.equal(r6);
      expect(r3).to.deep.equal(r7);
      expect(r4).to.deep.equal(r6);
    });

    it('Testing two items per page, six total, forward', async () => {
      const [item1, item2, item3, item4, item5, item6] = await createItems({
        count: 6, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2 });
      await validate(r1, [item1, item2], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item4], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item5, item6], true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      const r5 = await query(r4, false);
      await validate(r5, [item5, item6], true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, [item3, item4], true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, [item1, item2], false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, [item3, item4], true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, [item5, item6], true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);

      expect(r1).to.deep.equal(r7);
      expect(r2).to.deep.equal(r8);
      expect(r3).to.deep.equal(r9);
      expect(r4).to.deep.equal(r10);
      expect(r5).to.deep.equal(r3);
      expect(r6).to.deep.equal(r2);
    });

    it('Testing two items per page, six total, backwards', async () => {
      const [item1, item2, item3, item4, item5, item6] = await createItems({
        count: 6, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2, scanIndexForward: false });
      await validate(r1, [item6, item5], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item4, item3], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item2, item1], true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      const r5 = await query(r4, false);
      await validate(r5, [item2, item1], true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, [item4, item3], true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, [item6, item5], false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, [item4, item3], true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, [item2, item1], true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);

      expect(r1).to.deep.equal(r7);
      expect(r2).to.deep.equal(r8);
      expect(r3).to.deep.equal(r9);
      expect(r4).to.deep.equal(r10);
      expect(r5).to.deep.equal(r3);
      expect(r6).to.deep.equal(r2);
    });

    it('Testing single item per page, forward, with delete', async () => {
      const [item1, item2, item3] = await setupThreeItems();

      const r1 = await model.query(primaryKey, { limit: 1 });
      await validate(r1, item1, false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, item2, true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, item3, true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      await deleteItem(model, item1);
      const r5 = await query(r4, false);
      await validate(r5, item3, true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, item2, true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, null, false, true, 0);
      const r8 = await query(r7, true);
      await validate(r8, item2, false, true, 1);
      const r9 = await query(r8, true);
      await validate(r9, item3, true, true, 2);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 3);
    });

    it('Testing single item per page, backwards, with delete', async () => {
      const [item1, item2, item3] = await setupThreeItems();

      const r1 = await model.query(primaryKey, { limit: 1, scanIndexForward: false });
      await validate(r1, item3, false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, item2, true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, item1, true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      await deleteItem(model, item3);
      const r5 = await query(r4, false);
      await validate(r5, item1, true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, item2, true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, null, false, true, 0);
      const r8 = await query(r7, true);
      await validate(r8, item2, false, true, 1);
      const r9 = await query(r8, true);
      await validate(r9, item1, true, true, 2);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 3);
    });

    it('Testing two items per page, five total, forward, with delete', async () => {
      const [item1, item2, item3, item4, item5] = await createItems({
        count: 5, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2 });
      await validate(r1, [item1, item2], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item4], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item5], true, false, 3);
      await deleteItem(model, item1);
      const r4 = await query(r3, false);
      await validate(r4, [item3, item4], true, true, 2);
      const r5 = await query(r4, false);
      await validate(r5, [item2], false, true, 1);
      const r6 = await query(r5, true);
      await validate(r6, [item3, item4], true, true, 2);
      const r7 = await query(r6, true);
      await validate(r7, item5, true, false, 3);
    });

    it('Testing two items per page, five total, backwards, with delete', async () => {
      const [item1, item2, item3, item4, item5] = await createItems({
        count: 5, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2, scanIndexForward: false });
      await validate(r1, [item5, item4], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item2], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item1], true, false, 3);
      const r4 = await query(r3, false);
      await deleteItem(model, item5);
      await validate(r4, [item3, item2], true, true, 2);
      const r5 = await query(r4, false);
      await validate(r5, [item4], false, true, 1);
      const r6 = await query(r5, true);
      await validate(r6, [item3, item2], true, true, 2);
      const r7 = await query(r6, true);
      await validate(r7, item1, true, false, 3);
    });

    it('Testing two items per page, six total, forward, with delete', async () => {
      const [item1, item2, item3, item4, item5, item6] = await createItems({
        count: 6, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2 });
      await validate(r1, [item1, item2], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item3, item4], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item5, item6], true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      await deleteItem(model, item1);
      const r5 = await query(r4, false);
      await validate(r5, [item5, item6], true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, [item3, item4], true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, [item2], false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, [item3, item4], true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, [item5, item6], true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);
    });

    it('Testing two items per page, six total, backwards, with delete', async () => {
      const [item1, item2, item3, item4, item5, item6] = await createItems({
        count: 6, model, primaryKey, sortKey: 'name', age: 50
      });

      const r1 = await model.query(primaryKey, { limit: 2, scanIndexForward: false });
      await validate(r1, [item6, item5], false, true, 1);
      const r2 = await query(r1, true);
      await validate(r2, [item4, item3], true, true, 2);
      const r3 = await query(r2, true);
      await validate(r3, [item2, item1], true, true, 3);
      const r4 = await query(r3, true);
      await validate(r4, null, true, false, 4);
      await deleteItem(model, item6);
      const r5 = await query(r4, false);
      await validate(r5, [item2, item1], true, true, 3);
      const r6 = await query(r5, false);
      await validate(r6, [item4, item3], true, true, 2);
      const r7 = await query(r6, false);
      await validate(r7, [item5], false, true, 1);
      const r8 = await query(r7, true);
      await validate(r8, [item4, item3], true, true, 2);
      const r9 = await query(r8, true);
      await validate(r9, [item2, item1], true, true, 3);
      const r10 = await query(r9, true);
      await validate(r10, null, true, false, 4);
    });
  });
});
