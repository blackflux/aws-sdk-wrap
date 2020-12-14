const expect = require('chai').expect;
const { describe } = require('node-tdd');
const DocumentClient = require('aws-sdk').DynamoDB.DocumentClient;
const Index = require('../src/index');

describe('Testing index', { useNock: true }, () => {
  let aws;
  before(() => {
    aws = Index();
  });

  it('Testing exports', () => {
    expect(Object.keys(aws)).to.deep.equal([
      'updateGlobalConfig',
      'call',
      'get',
      'dy',
      's3',
      'sqs',
      'errors'
    ]);
  });

  it('Testing global configuration', () => {
    expect(aws.updateGlobalConfig({})).to.equal(undefined);
  });

  it('Testing nested get', () => {
    expect(aws.get('DynamoDB.DocumentClient')).to.be.instanceof(DocumentClient);
    expect(aws.get('DynamoDB.Converter')).to.be.a('object');
  });

  it('Testing Exception', async () => {
    try {
      await aws.call('s3:putObject', {});
    } catch (e) {
      expect(e.message).to.equal(
        'There were 2 validation errors:\n* MissingRequiredParameter: '
        + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
        + 'Missing required key \'Key\' in params'
      );
    }
  });

  it('Testing Expected Exception', async () => {
    const code = await aws.call('s3:putObject', {}, { expectedErrorCodes: ['MultipleValidationErrors'] });
    expect(code).to.equal('MultipleValidationErrors');
  });

  it('Testing Exception with Logger', async () => {
    try {
      await Index({
        logger: {
          warn: (msg) => {
            expect(msg).to.contain('Request failed for s3.putObject()');
          }
        }
      }).call('s3:putObject', {});
    } catch (e) {
      expect(e.message).to.equal(
        'There were 2 validation errors:\n* MissingRequiredParameter: '
        + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
        + 'Missing required key \'Key\' in params'
      );
    }
  });
});
