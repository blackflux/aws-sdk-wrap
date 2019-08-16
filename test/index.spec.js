const expect = require('chai').expect;
const { desc } = require('node-tdd');
const DocumentType = require('aws-sdk').DynamoDB.DocumentClient;
const index = require('./../src/index');

desc('Testing index', { useNock: true }, ({ before, it }) => {
  let aws;
  before(() => {
    aws = index();
  });

  it('Testing global configuration', () => {
    expect(aws.updateGlobalConfig({})).to.equal(undefined);
  });

  it('Testing nested get', () => {
    expect(aws.get('DynamoDB.DocumentClient')).to.be.instanceof(DocumentType);
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
      await index({
        logger: {
          error: (msg) => {
            expect(msg).to.deep.contain({
              message: 'Request failed for s3.putObject()',
              errorName: 'Error',
              requestParams: {}
            });
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
