import { expect } from 'chai';
import { describe } from 'node-tdd';
import Paging from '../../src/util/paging.js';

describe('Testing paging', () => {
  it('Testing fromCursor', () => {
    const { fromCursor } = Paging();
    // eslint-disable-next-line max-len
    const cursor = 'eyJsaW1pdCI6Miwic2NhbkluZGV4Rm9yd2FyZCI6ZmFsc2UsImV4Y2x1c2l2ZVN0YXJ0S2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUifSwiY3VycmVudFBhZ2UiOjB9';
    const result = fromCursor(cursor);
    expect(result).to.deep.equal({
      exclusiveStartKey: { id: '123', name: 'name' },
      scanIndexForward: false,
      currentPage: 0,
      limit: 2,
      type: undefined
    });
  });

  it('Testing invalid page cursor', () => {
    const { fromCursor } = Paging();
    const r = fromCursor('Invalid');
    expect(r).to.deep.equal({});
  });

  it('Testing buildPageObject with paginationKeys', () => {
    const { buildPageObject } = Paging();
    const result = buildPageObject({
      currentPage: 1,
      limit: 20,
      scanIndexForward: true,
      count: 20,
      items: [{ id: '123', name: 'name' }],
      paginationKeys: ['id', 'name']
    });
    expect(result).to.deep.equal({
      next: {
        // eslint-disable-next-line max-len
        cursor: 'eyJsaW1pdCI6MjAsInNjYW5JbmRleEZvcndhcmQiOnRydWUsImV4Y2x1c2l2ZVN0YXJ0S2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUifSwiY3VycmVudFBhZ2UiOjIsInR5cGUiOiJuZXh0In0='
      },
      previous: null,
      index: { current: 1 },
      size: 20
    });
  });

  it('Testing buildPageObject with null lastEvaluatedKey', () => {
    const { buildPageObject } = Paging();
    const result = buildPageObject({
      currentPage: 1,
      limit: 20,
      lastEvaluatedKey: null
    });
    expect(result).to.deep.equal({
      previous: null,
      next: null,
      index: { current: 1 },
      size: 20
    });
  });

  it('Testing cursor secret', () => {
    const { buildPageObject, fromCursor } = Paging('secret');
    const cursorPayload = {
      currentPage: 1,
      limit: 20,
      scanIndexForward: true,
      count: 20,
      items: [{ id: '123', name: 'name' }],
      paginationKeys: ['id', 'name']
    };
    const page = buildPageObject(cursorPayload);
    expect(page).to.deep.equal({
      previous: null,
      next: {
        // eslint-disable-next-line max-len
        cursor: 'eyJsaW1pdCI6MjAsInNjYW5JbmRleEZvcndhcmQiOnRydWUsImV4Y2x1c2l2ZVN0YXJ0S2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUifSwiY3VycmVudFBhZ2UiOjIsInR5cGUiOiJuZXh0In0=_lF+0Q60wO5uYRRoeuBLcjw'
      },
      index: {
        current: 1
      },
      size: 20
    });
    expect(fromCursor(page.next.cursor)).to.deep.equal({
      currentPage: 2,
      exclusiveStartKey: {
        id: '123',
        name: 'name'
      },
      limit: 20,
      scanIndexForward: true,
      type: 'next'
    });
  });

  it('Testing cursor secret signature mismatch', () => {
    const { buildPageObject, fromCursor } = Paging('secret');
    const page = buildPageObject({
      currentPage: 1,
      limit: 20,
      scanIndexForward: true,
      count: 20,
      items: [{ id: '123', name: 'name' }],
      paginationKeys: ['id', 'name']
    });
    const { cursor } = page.next;
    const cursorInvalid = [cursor.split('_')[0], 'bad-signature'].join('_');
    expect(fromCursor(cursorInvalid)).to.deep.equal({
      currentPage: undefined,
      exclusiveStartKey: undefined,
      limit: undefined,
      scanIndexForward: undefined,
      type: undefined
    });
  });

  it('Testing cursor with signature and no secret provided', () => {
    const cursorPayload = {
      currentPage: 1,
      limit: 20,
      scanIndexForward: true,
      count: 20,
      items: [{ id: '123', name: 'name' }],
      paginationKeys: ['id', 'name']
    };
    const { buildPageObject } = Paging('secret');
    const page = buildPageObject(cursorPayload);
    const cursor = page.next.cursor;
    const { fromCursor } = Paging();
    expect(fromCursor(cursor)).to.deep.equal({
      currentPage: 2,
      exclusiveStartKey: {
        id: '123',
        name: 'name'
      },
      limit: 20,
      scanIndexForward: true,
      type: 'next'
    });
  });

  it('Testing cursor with with no signature and secret provided', () => {
    const { buildPageObject } = Paging();
    const page = buildPageObject({
      currentPage: 1,
      limit: 20,
      scanIndexForward: true,
      count: 20,
      items: [{}],
      paginationKeys: ['id', 'name']
    });
    const { cursor } = page.next;
    const { fromCursor } = Paging('secret');
    expect(fromCursor(cursor)).to.deep.equal({
      currentPage: undefined,
      exclusiveStartKey: undefined,
      limit: undefined,
      scanIndexForward: undefined,
      type: undefined
    });
  });
});
