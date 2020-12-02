const expect = require('chai').expect;
const { describe } = require('node-tdd');
const index = require('../../src');
const { S3: S3Module } = require('../../src/module/s3');

describe('Testing s3 Util', {
  useNock: true,
  timeout: 10000,
  record: console
}, () => {
  let S3;
  let bucket;
  let key;
  beforeEach(() => {
    S3 = (opts = {}) => S3Module({
      call: index().call,
      logger: null,
      ...opts
    });
    bucket = process.env.BUCKET_NAME;
    key = 'key';
  });

  it('Testing "putGzipObject"', async () => {
    const result = await S3().putGzipObject({
      bucket,
      key,
      data: JSON.stringify({ data: 'data' })
    });
    expect(result).to.deep.equal({});
  });

  it('Testing "getGzipJsonObject"', async () => {
    const result = await S3().getGzipJsonObject({
      bucket,
      key
    });
    expect(result).to.deep.equal({
      data: 'data'
    });
  });

  it('Testing "getGzipJsonObject" with expected error', async () => {
    const result = await S3().getGzipJsonObject({
      bucket,
      key,
      expectedErrorCodes: ['NoSuchKey']
    });
    expect(result).to.equal('NoSuchKey');
  });

  it('Testing "headObject"', async () => {
    const result = await S3().headObject({ bucket, key });
    expect(result).to.deep.equal({
      ContentEncoding: 'gzip',
      Metadata: {}
    });
  });

  it('Testing "headObject" with expected error', async () => {
    const result = await S3().headObject({
      bucket,
      key,
      expectedErrorCodes: ['NotFound']
    });
    expect(result).to.equal('NotFound');
  });

  it('Testing "deleteObject"', async () => {
    const result = await S3().deleteObject({ bucket, key });
    expect(result).to.deep.equal({});
  });

  it('Testing "listObjects"', async () => {
    const result = await S3().listObjects({ bucket, limit: 1 });
    expect(result.continuationToken).to.equal('continuationToken');
    expect(result.isTruncated).to.equal(true);
    expect(result).to.deep.equal([{
      ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
      Key: 'key',
      Size: 135,
      StorageClass: 'STANDARD'
    }]);
  });

  it('Testing "listObjects" with "StartAfter"', async () => {
    const result = await S3().listObjects({
      bucket,
      limit: 10,
      startAfter: 'startAfter'
    });
    expect(result.continuationToken).to.equal(undefined);
    expect(result.isTruncated).to.equal(undefined);
    expect(result).to.deep.equal([{
      ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
      Key: 'key',
      Size: 135,
      StorageClass: 'STANDARD'
    }]);
  });

  it('Testing "listObjects" with "Prefix"', async () => {
    const result = await S3().listObjects({
      bucket,
      prefix: 'prefix'
    });
    expect(result).to.deep.equal([{
      ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
      Key: 'prefix',
      Size: 135,
      StorageClass: 'STANDARD'
    }]);
  });

  it('Testing "listObjects" with "ContinuationToken"', async () => {
    const result = await S3().listObjects({
      bucket,
      limit: 2
    });
    expect(result).to.deep.equal([
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: 'key',
        Size: 135,
        StorageClass: 'STANDARD'
      },
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: 'key2',
        Size: 130,
        StorageClass: 'STANDARD'
      }
    ]);
  });

  it('Testing "listObjects" with "StopAfter"', async () => {
    const result = await S3().listObjects({
      bucket,
      stopAfter: '2020-03-30T15:10:00.000Z'
    });
    expect(result).to.deep.equal([
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: '2020-03-30T15:00:00.000Z/key1',
        Size: 135,
        StorageClass: 'STANDARD'
      },
      {
        ETag: '"ede7147e166b322902e0e8fc33f4a876"',
        Key: '2020-03-30T15:05:00.000Z/key2',
        Size: 217,
        StorageClass: 'STANDARD'
      },
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: '2020-03-30T15:10:00.000Z',
        Size: 135,
        StorageClass: 'STANDARD'
      }
    ]);
  });

  it('Testing "listObjects" with "StopAfter" equal to last key', async () => {
    const result = await S3().listObjects({
      bucket,
      stopAfter: '2020-03-30T15:10:00.000Z'
    });
    expect(result).to.deep.equal([
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: '2020-03-30T15:00:00.000Z/key1',
        Size: 135,
        StorageClass: 'STANDARD'
      },
      {
        ETag: '"ede7147e166b322902e0e8fc33f4a876"',
        Key: '2020-03-30T15:10:00.000Z',
        Size: 217,
        StorageClass: 'STANDARD'
      }
    ]);
  });

  it('Testing "listObjects" with last key larger than "StopAfter"', async () => {
    const result = await S3().listObjects({
      bucket,
      stopAfter: '2020-03-30T15:10:00.000Z'
    });
    expect(result).to.deep.equal([
      {
        ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
        Key: '2020-03-30T15:00:00.000Z/key1',
        Size: 135,
        StorageClass: 'STANDARD'
      }
    ]);
  });

  it('Testing "listObjects" with "StopAfter" no items returned', async () => {
    const result = await S3().listObjects({
      bucket,
      stopAfter: '2020-03-30T15:10:00.000Z'
    });
    expect(result).to.deep.equal([]);
  });

  it('Testing "decodeKey"', () => {
    const result = S3().decodeKey('2018-10-25T20%3A55%3A00.000Z/Collection+Viewed.json.gz');
    expect(result).to.equal('2018-10-25T20:55:00.000Z/Collection Viewed.json.gz');
  });

  it('Testing error rate exceeds retry count', async ({ capture, recorder }) => {
    const s3 = S3({
      logger: console,
      backoffFunction: () => 0,
      maxRetries: 0
    });
    const error = await capture(() => s3.putGzipObject({
      bucket,
      key,
      data: JSON.stringify({ data: 'data' })
    }));
    expect(error).to.deep.contain({
      statusCode: 400
    });
    expect(recorder.get()).to.deep.equal([
      'Failed to submit s3:putObject\n'
      + 'Retrying: [{"action":"s3:putObject","opts":{"ContentType":"application/json","ContentEncoding":"gzip",'
      + '"Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,'
      + '73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}}}]'
    ]);
  });

  it('Testing error rate until fatal error', async ({ capture, recorder }) => {
    const s3 = S3({
      logger: console,
      backoffFunction: () => 0,
      maxRetries: 1
    });
    const error = await capture(() => s3.putGzipObject({
      bucket,
      key,
      data: JSON.stringify({ data: 'data' })
    }));
    expect(error).to.deep.contain({
      statusCode: 500
    });
    expect(recorder.get()).to.deep.equal([
      'Failed to submit s3:putObject\n'
      + 'Retrying: [{"action":"s3:putObject","opts":{"ContentType":"application/json","ContentEncoding":"gzip",'
      + '"Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,'
      + '73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}}}]'
    ]);
  });

  it('Testing error rate backoff function delays execution', async () => {
    const startTime = new Date();
    const result = await S3({
      maxRetries: 1,
      backoffFunction: () => 500
    }).putGzipObject({
      bucket,
      key,
      data: JSON.stringify({ data: 'data' })
    });
    const timeDiff = (new Date() - startTime);
    expect(result).to.deep.equal({});
    expect(timeDiff).to.be.greaterThan(500);
  });
});
