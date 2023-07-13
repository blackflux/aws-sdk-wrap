import util from 'util';
import zlib from 'zlib';
import get from 'lodash.get';
import Joi from 'joi-strict';

const sleep = util.promisify(setTimeout);

export default ({
  call,
  backoffFunction = (count) => 30 * (count ** 2),
  maxRetries = 10
}) => {
  const exec = async (
    action,
    opts,
    { expectedErrorCodes = [] } = {}
  ) => {
    let lastError;
    for (let count = 0; count <= maxRetries; count += 1) {
      if (count !== 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(backoffFunction(count));
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        return await call(action, opts, {
          expectedErrorCodes,
          meta: { retryCount: count }
        });
      } catch (e) {
        if (e.name !== 'SlowDown') {
          throw e;
        }
        lastError = e;
      }
    }
    throw lastError;
  };

  const putGzipObject = ({ bucket, key, data }) => exec('S3:PutObjectCommand', {
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Bucket: bucket,
    Key: key,
    Body: zlib.gzipSync(data, { level: 9 })
  });

  const getGzipJsonObject = async ({ bucket, key, expectedErrorCodes = [] }) => {
    const r = await exec(
      'S3:GetObjectCommand',
      { Bucket: bucket, Key: key },
      { expectedErrorCodes }
    );
    if (expectedErrorCodes.includes(r)) {
      return r;
    }
    const byteArray = await r.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const str = zlib.gunzipSync(buffer).toString('utf8');
    return JSON.parse(str);
  };

  const headObject = ({ bucket, key, expectedErrorCodes = [] }) => exec(
    'S3:HeadObjectCommand',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  );

  const deleteObject = ({ bucket, key, expectedErrorCodes = [] }) => exec(
    'S3:DeleteObjectCommand',
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
    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await exec('S3:ListObjectsV2Command', {
        Bucket: bucket,
        ...(limit === undefined ? {} : { MaxKeys: Math.min(1000, limit - result.length) }),
        ...(prefix === undefined ? {} : { Prefix: prefix }),
        ...(continuationToken === undefined && startAfter !== undefined ? { StartAfter: startAfter } : {}),
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken })
      });
      if (
        stopAfter !== null
        && response.KeyCount > 0
        && response.Contents[response.Contents.length - 1].Key >= stopAfter
      ) {
        const sliceIdx = response.Contents.findIndex((e) => e.Key > stopAfter);
        result.push(...(sliceIdx === -1 ? response.Contents : response.Contents.slice(0, sliceIdx)));
        continuationToken = undefined;
        isTruncated = false;
      } else {
        result.push(...(response.Contents || []));
        continuationToken = response.NextContinuationToken;
        isTruncated = response.IsTruncated;
      }
    } while (isTruncated === true && (limit === undefined || result.length < limit));
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
