const expect = require('chai').expect;
const { describe } = require('node-tdd');
const index = require('../../src');

describe('Testing s3 Util', { useNock: true, timestamp: 1569876020 }, () => {
  let aws;
  let bucket;
  let key;
  beforeEach(() => {
    aws = index();
    bucket = process.env.BUCKET_NAME;
    key = 'key';
  });

  it('Testing "putGzipObject"', async () => {
    const result = await aws.s3.putGzipObject({
      bucket,
      key,
      data: JSON.stringify({ data: 'data' })
    });
    expect(result).to.deep.equal({});
  });

  it('Testing "getGzipJsonObject"', async () => {
    const result = await aws.s3.getGzipJsonObject({
      bucket,
      key
    });
    expect(result).to.deep.equal({
      data: 'data'
    });
  });

  it('Testing "getGzipJsonObject" with expected error', async () => {
    const result = await aws.s3.getGzipJsonObject({
      bucket,
      key,
      expectedErrorCodes: ['NoSuchKey']
    });
    expect(result).to.equal('NoSuchKey');
  });

  it('Testing "headObject"', async () => {
    const result = await aws.s3.headObject({ bucket, key });
    expect(result).to.deep.equal({
      ContentEncoding: 'gzip',
      Metadata: {}
    });
  });

  it('Testing "headObject" with expected error', async () => {
    const result = await aws.s3.headObject({
      bucket,
      key,
      expectedErrorCodes: ['NotFound']
    });
    expect(result).to.equal('NotFound');
  });

  it('Testing "deleteObject"', async () => {
    const result = await aws.s3.deleteObject({ bucket, key });
    expect(result).to.deep.equal({});
  });

  it('Testing "listObjects"', async () => {
    const result = await aws.s3.listObjects({ bucket, limit: 1 });
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
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
    const result = await aws.s3.listObjects({
      bucket,
      stopAfter: '2020-03-30T15:10:00.000Z'
    });
    expect(result).to.deep.equal([]);
  });

  it('Testing "decodeKey"', () => {
    const result = aws.s3.decodeKey('2018-10-25T20%3A55%3A00.000Z/Collection+Viewed.json.gz');
    expect(result).to.equal('2018-10-25T20:55:00.000Z/Collection Viewed.json.gz');
  });
});
