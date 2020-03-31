const zlib = require('zlib');
const Joi = require('joi-strict');

module.exports.S3 = ({ call }) => {
  const putGzipObject = ({ bucket, key, data }) => call('s3:putObject', {
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Bucket: bucket,
    Key: key,
    Body: zlib.gzipSync(data, { level: 9 })
  });

  const getGzipJsonObject = ({ bucket, key, expectedErrorCodes = [] }) => call(
    's3:getObject',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  ).then((r) => (expectedErrorCodes.includes(r) ? r : JSON.parse(zlib.gunzipSync(r.Body).toString('utf8'))));

  const headObject = ({ bucket, key, expectedErrorCodes = [] }) => call(
    's3:headObject',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  );

  const deleteObject = ({ bucket, key, expectedErrorCodes = [] }) => call(
    's3:deleteObject',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  );

  const listObjects = async (kwargs) => {
    Joi.assert(kwargs, Joi.object().keys({
      bucket: Joi.string(),
      limit: Joi.number().integer().min(1).optional(),
      startAfter: Joi.string().optional(),
      stopAfter: Joi.string().optional(),
      prefix: Joi.string().optional(),
      continuationToken: Joi.string().optional()
    }));
    const {
      bucket,
      limit,
      startAfter,
      stopAfter = null,
      prefix
    } = kwargs;
    const result = [];
    let continuationToken = kwargs.continuationToken;
    let isTruncated;
    let stopAfterFlag = false;
    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await call('s3:listObjectsV2', {
        Bucket: bucket,
        ...(limit === undefined ? {} : { MaxKeys: Math.min(1000, limit - result.length) }),
        ...(prefix === undefined ? {} : { Prefix: prefix }),
        ...(continuationToken === undefined && startAfter !== undefined ? { StartAfter: startAfter } : {}),
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken })
      });
      if (stopAfter !== null) {
        const entries = [...response.Contents];
        for (let i = 0; i < entries.length; i += 1) {
          if (entries[i].Key > stopAfter) {
            stopAfterFlag = true;
            response.Contents = entries.slice(0, i);
            break;
          }
        }
      }
      result.push(...response.Contents);
      continuationToken = response.NextContinuationToken;
      isTruncated = response.IsTruncated;
    } while (isTruncated === true && stopAfterFlag === false && (limit === undefined || result.length < limit));
    result.continuationToken = continuationToken;
    result.isTruncated = isTruncated;
    return result;
  };

  // https://stackoverflow.com/questions/39465220#answer-42184248
  const decodeKey = (key) => decodeURIComponent(key.replace(/\+/g, ' '));

  return {
    putGzipObject,
    getGzipJsonObject,
    headObject,
    deleteObject,
    listObjects,
    decodeKey
  };
};
