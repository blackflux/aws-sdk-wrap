import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { expect } from 'chai';
import { describe } from 'node-tdd';
import Index from '../../src/index.js';
import S3Module from '../../src/module/s3.js';
import nockReqHeaderOverwrite from '../req-header-overwrite.js';
import retryStrategy from '../helper/retry-strategy.js';

describe('Testing s3 Util', {
  useNock: true,
  nockReqHeaderOverwrite,
  timeout: 10000,
  envVarsFile: '../default.env.yml'
}, () => {
  let S3;
  let bucket;
  let key;
  beforeEach(() => {
    S3 = (opts = {}) => S3Module({
      call: Index({
        logger: console,
        config: { retryStrategy },
        services: {
          S3: S3Client,
          'S3:CMD': {
            PutObjectCommand,
            GetObjectCommand,
            HeadObjectCommand,
            DeleteObjectCommand,
            ListObjectsV2Command
          }
        }
      }).call,
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
    expect(result).to.deep.equal({
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
        totalRetryDelay: 0
      }
    });
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
      Metadata: {},
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
        totalRetryDelay: 0
      }
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
    expect(result).to.deep.equal({
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 204,
        requestId: undefined,
        totalRetryDelay: 0
      }
    });
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
    expect(result).to.deep.equal({
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
        totalRetryDelay: 0
      }
    });
    expect(timeDiff).to.be.greaterThan(500);
  });

  describe('Testing with logs', {
    timestamp: '2020-12-08T21:38:37.124Z',
    record: console
  }, () => {
    it('Testing error rate does not exceed retry count', async ({ recorder }) => {
      const s3 = S3({
        backoffFunction: () => 0,
        maxRetries: 1
      });
      const result = await s3.putGzipObject({
        bucket,
        key,
        data: JSON.stringify({ data: 'data' })
      });
      expect(result).to.deep.equal({
        $metadata: {
          attempts: 1,
          cfId: undefined,
          extendedRequestId: undefined,
          httpStatusCode: 200,
          requestId: undefined,
          totalRetryDelay: 0
        }
      });
      expect(recorder.get()).to.deep.equal([
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"SlowDown","$fault":"client","$metadata":{"httpStatusCode":503,"attempts":1,"totalRetryDelay":0},"Code":"SlowDown","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"C30E1BAD9206F9FD","HostId":"7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI=","message":"Reduce your request rate."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":0}}'
      ]);
    });

    it('Testing error rate until fatal error', async ({ capture, recorder }) => {
      const s3 = S3({
        backoffFunction: () => 0,
        maxRetries: 1
      });
      const error = await capture(() => s3.putGzipObject({
        bucket,
        key,
        data: JSON.stringify({ data: 'data' })
      }));
      expect(error).to.deep.contain({
        $metadata: {
          attempts: 1,
          cfId: undefined,
          extendedRequestId: undefined,
          httpStatusCode: 503,
          requestId: undefined,
          totalRetryDelay: 0
        },
        Code: 'SlowDown',
        Endpoint: 's3.amazonaws.com',
        Bucket: 'test-bucket-name',
        RequestId: 'C30E1BAD9206F9FD',
        HostId: '7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI='
      });
      expect(recorder.get()).to.deep.equal([
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"SlowDown","$fault":"client","$metadata":{"httpStatusCode":503,"attempts":1,"totalRetryDelay":0},"Code":"SlowDown","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"C30E1BAD9206F9FD","HostId":"7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI=","message":"Reduce your request rate."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":0}}',
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"SlowDown","$fault":"client","$metadata":{"httpStatusCode":503,"attempts":1,"totalRetryDelay":0},"Code":"SlowDown","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"C30E1BAD9206F9FD","HostId":"7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI=","message":"Reduce your request rate."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":1}}'
      ]);
    });

    it('Testing error handling no retry', async ({ capture, recorder }) => {
      const s3 = S3();
      const error = await capture(() => s3.putGzipObject({
        bucket,
        key,
        data: JSON.stringify({ data: 'data' })
      }));
      expect(error).to.deep.contain({
        $fault: 'client',
        $metadata: {
          httpStatusCode: 500,
          requestId: undefined,
          extendedRequestId: undefined,
          cfId: undefined,
          attempts: 1,
          totalRetryDelay: 0
        },
        Code: 'PermanentRedirect',
        Endpoint: 's3.amazonaws.com',
        Bucket: 'test-bucket-name',
        RequestId: '3AE2F6662208B202',
        HostId: 'X5h1Z9Fr2p/BY5vhraKcGoIT3IV1GSS+n+BB1Dj6sMSOAu7r+khvFGNfcfr1OoE34NekexKP3lc='
      });
      expect(recorder.get()).to.deep.equal([
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"PermanentRedirect","$fault":"client","$metadata":{"httpStatusCode":500,"attempts":1,"totalRetryDelay":0},"Code":"PermanentRedirect","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"3AE2F6662208B202","HostId":"X5h1Z9Fr2p/BY5vhraKcGoIT3IV1GSS+n+BB1Dj6sMSOAu7r+khvFGNfcfr1OoE34NekexKP3lc=","message":"The bucket you are attempting to access must be addressed using the specified endpoint. Please send all future requests to this endpoint."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":0}}'
      ]);
    });

    it('Testing error with default backOffFunction', async ({ capture, recorder }) => {
      const s3 = S3({ maxRetries: 1 });
      const error = await capture(() => s3.putGzipObject({
        bucket,
        key,
        data: JSON.stringify({ data: 'data' })
      }));
      expect(error).to.deep.contain({
        $fault: 'client',
        $metadata: {
          httpStatusCode: 503,
          requestId: undefined,
          extendedRequestId: undefined,
          cfId: undefined,
          attempts: 1,
          totalRetryDelay: 0
        },
        Code: 'SlowDown',
        Endpoint: 's3.amazonaws.com',
        Bucket: 'test-bucket-name',
        RequestId: 'C30E1BAD9206F9FD',
        HostId: '7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI='
      });
      expect(recorder.get()).to.deep.equal([
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"SlowDown","$fault":"client","$metadata":{"httpStatusCode":503,"attempts":1,"totalRetryDelay":0},"Code":"SlowDown","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"C30E1BAD9206F9FD","HostId":"7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI=","message":"Reduce your request rate."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":0}}',
        // eslint-disable-next-line max-len
        'Request failed for S3.PutObjectCommand()\n{"errorName":"S3ServiceException","errorDetails":{"name":"SlowDown","$fault":"client","$metadata":{"httpStatusCode":503,"attempts":1,"totalRetryDelay":0},"Code":"SlowDown","Endpoint":"s3.amazonaws.com","Bucket":"test-bucket-name","RequestId":"C30E1BAD9206F9FD","HostId":"7Dk91X8guy/UBOfV5/6xu4aZSlBogExu9zsJ9mz9JPL6rSoz+JdVVl4e2iQm/eFNXOud+4RB0WI=","message":"Reduce your request rate."},"requestParams":{"ContentType":"application/json","ContentEncoding":"gzip","Bucket":"test-bucket-name","Key":"key","Body":{"type":"Buffer","data":[31,139,8,0,0,0,0,0,2,3,171,86,74,73,44,73,84,178,130,80,181,0,185,30,67,221,15,0,0,0]}},"meta":{"retryCount":1}}'
      ]);
    });
  });
});
