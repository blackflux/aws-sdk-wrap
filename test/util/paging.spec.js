import { expect } from 'chai';
import { describe } from 'node-tdd';
import Paging from '../../src/util/paging.js';

describe('Testing paging', () => {
  it('Testing fromCursor', () => {
    const { fromCursor } = Paging();
    // eslint-disable-next-line max-len
    const cursor = 'eyJsYXN0RXZhbHVhdGVkS2V5Ijp7ImlkIjoiMTIzIiwibmFtZSI6Im5hbWUifSwic2NhbkluZGV4Rm9yd2FyZCI6dHJ1ZSwiY3VycmVudFBhZ2UiOjAsImxpbWl0IjoyMH0=';
    const result = fromCursor(cursor);
    expect(result).to.deep.equal({
      lastEvaluatedKey: { id: '123', name: 'name' },
      scanIndexForward: true,
      currentPage: 0,
      limit: 20
    });
  });

  it('Testing invalid page cursor', () => {
    const { fromCursor } = Paging();
    try {
      fromCursor('Invalid');
    } catch (error) {
      expect(error.message).to.equal('Page cursor is invalid');
    }
  });

  it('Testing buildPageObject with lastEvaluatedKey', () => {
    const { buildPageObject } = Paging();
    const result = buildPageObject({
      currentPage: 0,
      limit: 20,
      scanIndexForward: true,
      lastEvaluatedKey: { id: '123', name: 'name' }
    });
    expect(result).to.deep.equal({
      next: {
        limit: 20,
        // eslint-disable-next-line max-len
        cursor: 'eyJsaW1pdCI6MjAsInNjYW5JbmRleEZvcndhcmQiOnRydWUsImxhc3RFdmFsdWF0ZWRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZSJ9LCJjdXJyZW50UGFnZSI6MX0='
      },
      index: { current: 0 },
      size: 20
    });
  });

  it('Testing buildPageObject with null lastEvaluatedKey', () => {
    const { buildPageObject } = Paging();
    const result = buildPageObject({
      currentPage: 0,
      limit: 20,
      lastEvaluatedKey: null
    });
    expect(result).to.deep.equal({
      next: null,
      index: { current: 0 },
      size: 20
    });
  });

  it('Testing cursor secret', () => {
    const { buildPageObject, fromCursor } = Paging('secret');
    const cursorPayload = {
      currentPage: 0,
      limit: 20,
      scanIndexForward: true,
      lastEvaluatedKey: { id: '123', name: 'name' }
    };
    const page = buildPageObject(cursorPayload);
    expect(page).to.deep.equal({
      next: {
        limit: 20,
        // eslint-disable-next-line max-len
        cursor: 'eyJsaW1pdCI6MjAsInNjYW5JbmRleEZvcndhcmQiOnRydWUsImxhc3RFdmFsdWF0ZWRLZXkiOnsiaWQiOiIxMjMiLCJuYW1lIjoibmFtZSJ9LCJjdXJyZW50UGFnZSI6MX0=_+c2knEGwaWFjChOgLtMsvw'
      },
      index: {
        current: 0
      },
      size: 20
    });
    expect(fromCursor(page.next.cursor)).to.deep.equal({
      ...cursorPayload,
      currentPage: 1
    });
  });

  it('Testing cursor secret signature mismatch', () => {
    const { buildPageObject, fromCursor } = Paging('secret');
    const page = buildPageObject({
      currentPage: 0,
      limit: 20,
      scanIndexForward: true,
      lastEvaluatedKey: { id: '123', name: 'name' }
    });
    const { cursor } = page.next;
    const cursorInvalid = [cursor.split('_')[0], 'bad-signature'].join('_');
    expect(fromCursor(cursorInvalid)).to.deep.equal({
      currentPage: undefined,
      lastEvaluatedKey: undefined,
      limit: undefined,
      scanIndexForward: undefined
    });
  });

  it('Testing cursor with signature and no secret provided', () => {
    const cursorPayload = {
      currentPage: 0,
      limit: 20,
      scanIndexForward: true,
      lastEvaluatedKey: { id: '123', name: 'name' }
    };
    const { buildPageObject } = Paging('secret');
    const page = buildPageObject(cursorPayload);
    const { cursor } = page.next;
    const { fromCursor } = Paging();
    expect(fromCursor(cursor)).to.deep.equal({
      ...cursorPayload,
      currentPage: 1
    });
  });

  it('Testing cursor with with no signature and secret provided', () => {
    const { buildPageObject } = Paging();
    const page = buildPageObject({
      currentPage: 0,
      limit: 20,
      scanIndexForward: true,
      lastEvaluatedKey: { id: '123', name: 'name' }
    });
    const { cursor } = page.next;
    const { fromCursor } = Paging('secret');
    expect(fromCursor(cursor)).to.deep.equal({
      currentPage: undefined,
      lastEvaluatedKey: undefined,
      limit: undefined,
      scanIndexForward: undefined
    });
  });
});
