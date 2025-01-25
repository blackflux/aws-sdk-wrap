import crypto from 'crypto';

const makeSignature = (cursor, cursorSecret) => crypto
  .createHash('md5')
  .update(cursor)
  .update(cursorSecret)
  .digest('base64')
  .slice(0, -2);

const objectEncode = (obj, cursorSecret) => {
  const cursor = Buffer.from(JSON.stringify(obj)).toString('base64');
  return typeof cursorSecret === 'string'
    ? `${cursor}_${makeSignature(cursor, cursorSecret)}`
    : cursor;
};
const objectDecode = (base64, cursorSecret) => {
  const [cursor, signature] = base64.split('_');
  if (
    typeof cursorSecret === 'string'
    && signature !== makeSignature(cursor, cursorSecret)
  ) {
    return {};
  }
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
};

const toCursor = ({
  limit,
  scanIndexForward,
  exclusiveStartKey,
  currentPage,
  type
}, cursorSecret) => objectEncode({
  limit,
  scanIndexForward,
  exclusiveStartKey,
  currentPage,
  type
}, cursorSecret);

const getPageKeyFromItem = (item, pagingKeys) => Object.fromEntries(pagingKeys
  .filter((k) => k in item)
  .sort()
  .map((k) => [k, item[k]]));

export default (cursorSecret) => {
  const fromCursor = (cursor = null) => {
    let cursorPayload = {};
    if (cursor !== null) {
      try {
        cursorPayload = objectDecode(cursor, cursorSecret);
      } catch {
        return {};
      }
    }
    const {
      limit, scanIndexForward, exclusiveStartKey, currentPage, type
    } = cursorPayload;
    return {
      limit, scanIndexForward, exclusiveStartKey, currentPage, type
    };
  };

  const buildPageObject = ({
    limit,
    scanIndexForward,
    count,
    items,
    currentPage: currentPage_ = 1,
    paginationKeys,
    direction = 'next'
  }) => {
    let previous = null;
    let next = null;
    let startPageKey = null;
    let endPageKey = null;

    if (Array.isArray(items) && Array.isArray(paginationKeys)) {
      startPageKey = items.length === 0 ? undefined : getPageKeyFromItem(items[0], paginationKeys);
      endPageKey = items.length === 0 ? undefined : getPageKeyFromItem(items[items.length - 1], paginationKeys);
    }

    const currentPage = direction === 'previous' && items?.length === 0 ? 0 : currentPage_;

    if (currentPage > 1 && startPageKey !== null) {
      previous = {
        cursor: toCursor({
          limit,
          currentPage: currentPage - 1,
          exclusiveStartKey: startPageKey,
          scanIndexForward,
          type: 'previous'
        }, cursorSecret)
      };
    }
    if (direction === 'previous' || (count === limit && endPageKey !== null)) {
      next = {
        cursor: toCursor({
          limit,
          currentPage: currentPage + 1,
          exclusiveStartKey: endPageKey,
          scanIndexForward,
          type: 'next'
        }, cursorSecret)
      };
    }
    return {
      previous,
      next,
      index: { current: currentPage },
      size: limit
    };
  };

  return { fromCursor, buildPageObject };
};
