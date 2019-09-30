const expect = require('chai').expect;
const { describe } = require('node-tdd');
const index = require('../../src');

describe('Testing s3 Util', {
  useNock: true,
  envVarsFile: 'config.env.yml',
  timestamp: 1569876020
}, () => {
  let aws;
  let bucket;
  let key;
  before(() => {
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

  it('Testing "getGzipObject"', async () => {
    const result = await aws.s3.getGzipObject({
      bucket,
      key,
      expectedErrorCodes: []
    });
    expect(result).to.deep.equal({
      data: 'data'
    });
  });

  it('Testing "getGzipObject" with expected error', async () => {
    const result = await aws.s3.getGzipObject({
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
    const result = await aws.s3.listObjects({
      bucket,
      limit: 10,
      continuationToken: 'continuationToken'
    });
    expect(result).to.deep.equal(
      {
        CommonPrefixes: [],
        Contents: [
          {
            ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
            Key: 'key',
            Size: 135,
            StorageClass: 'STANDARD'
          }
        ],
        IsTruncated: true,
        KeyCount: 10,
        MaxKeys: 10,
        Name: 'test-bucket-name',
        ContinuationToken: 'continuationToken',
        Prefix: ''
      }
    );
  });

  it('Testing "listObjects" with null continuationToken', async () => {
    const result = await aws.s3.listObjects({ bucket, limit: 10 });
    expect(result).to.deep.equal(
      {
        CommonPrefixes: [],
        Contents: [
          {
            ETag: '"a32d8ca2be8b6454d40b230fcc4a2fc4"',
            Key: 'key',
            Size: 135,
            StorageClass: 'STANDARD'
          }
        ],
        IsTruncated: true,
        KeyCount: 10,
        MaxKeys: 10,
        Name: 'test-bucket-name',
        NextContinuationToken: 'continuationToken',
        Prefix: ''
      }
    );
  });

  it('Testing "getSignedUrl"', () => {
    const result = aws.s3.getSignedUrl({
      bucket,
      key,
      expires: 1569876020
    });
    expect(result).to.equal('https://test-bucket-name.s3.us-west-2.amazonaws.com/'
      + 'key?AWSAccessKeyId=%7BXXXXXXXXXXXXXXXXXXXX%7D&Expires=3139752040&Signature=NluM7ESOWbzyAafdtNwxuGik4eA%3D');
  });

  it('Testing "escapeBucketKey"', () => {
    const result = aws.s3.escapeBucketKey('2018-10-25T20%3A55%3A00.000Z/Collection+Viewed.json.gz');
    expect(result).to.equal('2018-10-25T20:55:00.000Z/Collection Viewed.json.gz');
  });
});
