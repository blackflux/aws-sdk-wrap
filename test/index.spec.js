import { expect } from 'chai';
import { describe } from 'node-tdd';
import AWS from 'aws-sdk';
import Index from '../src/index.js';

const { DynamoDB } = AWS;
const { DocumentClient } = DynamoDB;

describe('Testing index', { useNock: true }, () => {
  let aws;
  before(() => {
    aws = Index({
      services: {
        'DynamoDB.DocumentClient': AWS.DynamoDB.DocumentClient,
        'DynamoDB.Converter': AWS.DynamoDB.Converter,
        S3: AWS.S3
      }
    });
  });

  it('Testing exports', () => {
    expect(Object.keys(aws)).to.deep.equal([
      'updateGlobalConfig',
      'call',
      'get',
      'dy',
      's3',
      'sqs',
      'lambda',
      'errors'
    ]);
  });

  it('Testing global configuration', () => {
    expect(aws.updateGlobalConfig(aws, {})).to.equal(undefined);
  });

  it('Testing nested get', () => {
    expect(aws.get('DynamoDB.DocumentClient')).to.be.instanceof(DocumentClient);
    expect(aws.get('DynamoDB.Converter')).to.be.a('object');
  });

  it('Testing Exception', async ({ capture }) => {
    const error = await capture(() => aws.call('s3:putObject', {}));
    expect(error.message).to.equal(
      'There were 2 validation errors:\n* MissingRequiredParameter: '
      + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
      + 'Missing required key \'Key\' in params'
    );
  });

  it('Testing Expected Exception', async () => {
    const code = await aws.call('s3:putObject', {}, { expectedErrorCodes: ['MultipleValidationErrors'] });
    expect(code).to.equal('MultipleValidationErrors');
  });

  it('Testing Exception with Logger', async ({ capture }) => {
    const awsCustomLogger = Index({
      logger: {
        warn: (msg) => {
          expect(msg).to.contain('Request failed for s3.putObject()');
        }
      },
      services: {
        s3: AWS.S3
      }
    });
    const err = await capture(() => awsCustomLogger.call('s3:putObject', {}));
    expect(err.message).to.equal(
      'There were 2 validation errors:\n* MissingRequiredParameter: '
      + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
      + 'Missing required key \'Key\' in params'
    );
  });
});
