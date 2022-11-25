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
  let cursor = base64;
  if (typeof cursorSecret === 'string') {
    let signature;
    [cursor, signature] = base64.split('_');
    if (signature !== makeSignature(cursor, cursorSecret)) {
      return {};
    }
  }
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
};

const toCursor = ({
  limit, scanIndexForward, lastEvaluatedKey, currentPage
}, cursorSecret) => objectEncode({
  limit, scanIndexForward, lastEvaluatedKey, currentPage
}, cursorSecret);

export default (cursorSecret) => {
  const fromCursor = (cursor = null) => {
    let cursorPayload = {};
    if (cursor !== null) {
      try {
        cursorPayload = objectDecode(cursor, cursorSecret);
      } catch (err) {
        throw new Error('Page cursor is invalid');
      }
    }
    const {
      limit, scanIndexForward, lastEvaluatedKey, currentPage
    } = cursorPayload;
    return {
      limit, scanIndexForward, lastEvaluatedKey, currentPage
    };
  };

  const buildPageObject = ({
    currentPage, limit, scanIndexForward, lastEvaluatedKey
  }) => {
    const next = lastEvaluatedKey === null ? null : { limit };
    if (next !== null) {
      next.cursor = toCursor({
        lastEvaluatedKey,
        scanIndexForward,
        currentPage: currentPage + 1,
        ...next
      }, cursorSecret);
    }
    return {
      next,
      index: { current: currentPage },
      size: limit
    };
  };

  return { fromCursor, buildPageObject };
};
