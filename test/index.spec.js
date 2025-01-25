import { expect } from 'chai';
import { describe } from 'node-tdd';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Index from '../src/index.js';
import nockReqHeaderOverwrite from './req-header-overwrite.js';

describe('Testing index', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  envVarsFile: './default.env.yml'
}, () => {
  let aws;
  let logs;

  beforeEach(() => {
    logs = [];
    aws = Index({
      services: {
        S3: S3Client,
        'S3:CMD': { PutObjectCommand }
      },
      onCall: (kwargs) => logs.push(kwargs)
    });
  });

  it('Testing exports', () => {
    expect(Object.keys(aws)).to.deep.equal([
      'call',
      'get',
      'dy',
      's3',
      'sqs',
      'lambda',
      'errors'
    ]);
  });

  it('Testing Exception', async ({ capture }) => {
    const error = await capture(() => aws.call('S3:PutObjectCommand', {}));
    expect(error.message).to.equal('No value provided for input HTTP label: Bucket.');
  });

  it('Testing Expected Exception', async ({ capture }) => {
    const code = await capture(
      () => aws.call('S3:PutObjectCommand', {}, { expectedErrorCodes: ['MultipleValidationErrors'] })
    );
    expect(code.message).to.equal('No value provided for input HTTP label: Bucket.');
    expect(logs[0]).to.deep.includes({
      action: 'S3:PutObjectCommand',
      params: {},
      status: '5xx',
      response: undefined
    });
  });

  it('Testing Exception with Logger', async ({ capture }) => {
    const awsCustomLogger = Index({
      logger: {
        warn: (msg) => {
          expect(msg).to.contain('Request failed for S3.PutObjectCommand()');
        }
      },
      services: {
        S3: S3Client,
        'S3:CMD': { PutObjectCommand }
      }
    });
    const err = await capture(() => awsCustomLogger.call('S3:PutObjectCommand', {}));
    expect(err.message).to.equal('No value provided for input HTTP label: Bucket.');
  });
});
