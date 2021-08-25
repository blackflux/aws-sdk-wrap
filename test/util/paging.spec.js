const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { fromCursor, buildPageObject } = require('../../src/util/paging');

describe('Testing paging', () => {
  it('Testing fromCursor', () => {
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
    try {
      fromCursor('Invalid');
    } catch (error) {
      expect(error.message).to.equal('Page cursor is invalid');
    }
  });

  it('Testing buildPageObject with lastEvaluatedKey', () => {
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
});
