const objectEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');
const objectDecode = (base64) => JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

const toCursor = ({
  limit, scanIndexForward, lastEvaluatedKey, currentPage
}) => objectEncode({
  limit, scanIndexForward, lastEvaluatedKey, currentPage
});

module.exports.fromCursor = (cursor = null) => {
  let cursorPayload = {};
  if (cursor !== null) {
    try {
      cursorPayload = objectDecode(cursor);
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

module.exports.buildPageObject = ({
  currentPage, limit, scanIndexForward, lastEvaluatedKey
}) => {
  const next = lastEvaluatedKey === null ? null : { limit };
  if (next !== null) {
    next.cursor = toCursor({
      lastEvaluatedKey,
      scanIndexForward,
      currentPage: currentPage + 1,
      ...next
    });
  }
  return {
    next,
    index: { current: currentPage },
    size: limit
  };
};
