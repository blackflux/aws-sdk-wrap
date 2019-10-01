const zlib = require('zlib');

module.exports.S3 = ({ call }) => {
  const putGzipObject = ({ bucket, key, data }) => call('s3:putObject', {
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Bucket: bucket,
    Key: key,
    Body: zlib.gzipSync(data, { level: 9 })
  });

  const getGzipObject = ({ bucket, key, expectedErrorCodes }) => call(
    's3:getObject',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  ).then((r) => (expectedErrorCodes.includes(r) ? r : JSON.parse(zlib.gunzipSync(r.Body).toString('utf8'))));

  const headObject = ({ bucket, key, expectedErrorCodes }) => call(
    's3:headObject',
    { Bucket: bucket, Key: key },
    { expectedErrorCodes }
  );

  const deleteObject = ({ bucket, key }) => call('s3:deleteObject', { Bucket: bucket, Key: key });

  const listObjects = async ({ bucket, limit, startAfter = undefined }) => {
    const result = [];
    let continuationToken;
    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await call('s3:listObjectsV2', {
        Bucket: bucket,
        MaxKeys: Math.min(1000, limit - result.length),
        ...(continuationToken === undefined && startAfter !== undefined ? { StartAfter: startAfter } : {}),
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken })
      });
      result.push(...response.Contents);
      continuationToken = response.NextContinuationToken;
    } while (continuationToken !== undefined && result.length < limit);
    return result;
  };

  // https://stackoverflow.com/questions/39465220#answer-42184248
  const escapeKey = (key) => decodeURIComponent(key.replace(/\+/g, ' '));

  return {
    putGzipObject,
    getGzipObject,
    headObject,
    deleteObject,
    listObjects,
    escapeKey
  };
};
