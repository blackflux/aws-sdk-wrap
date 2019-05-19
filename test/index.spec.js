const path = require('path');
const expect = require('chai').expect;
const nockBack = require('nock').back;
const DocumentType = require('aws-sdk').DynamoDB.DocumentClient;
const index = require('./../src/index');

describe('Testing index', () => {
  let aws;
  before(() => {
    aws = index();
    nockBack.setMode('record');
    nockBack.fixtures = path.join(__dirname, '__cassettes');
  });

  it('Testing global configuration', () => {
    expect(aws.updateGlobalConfig({})).to.equal(undefined);
  });

  it('Testing nested get', () => {
    expect(aws.get('DynamoDB.DocumentClient')).to.be.instanceof(DocumentType);
    expect(aws.get('DynamoDB.Converter')).to.be.a('object');
  });

  it('Testing Exception', (done) => {
    nockBack('s3-putObject-fail.json', async (nockDone) => {
      aws.call('s3:putObject', {}).catch((e) => {
        expect(e.message).to.equal(
          'There were 2 validation errors:\n* MissingRequiredParameter: '
          + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
          + 'Missing required key \'Key\' in params'
        );
        nockDone();
        done();
      }).then(done.fail);
    });
  });

  it('Testing Expected Exception', (done) => {
    nockBack('s3-putObject-fail-expected.json', async (nockDone) => {
      aws.call('s3:putObject', {}, { expectedErrorCodes: ['MultipleValidationErrors'] }).then((code) => {
        expect(code).to.equal('MultipleValidationErrors');
        nockDone();
        done();
      }).catch(done.fail);
    });
  });

  it('Testing Exception with Logger', (done) => {
    nockBack('s3-putObject-fail-with-logger.json', async (nockDone) => {
      index({
        logger: {
          error: (msg) => {
            expect(msg).to.deep.contain({
              message: 'Request failed for s3.putObject()',
              errorName: 'Error',
              requestParams: {}
            });
          }
        }
      }).call('s3:putObject', {}).catch((e) => {
        expect(e.message).to.equal(
          'There were 2 validation errors:\n* MissingRequiredParameter: '
          + 'Missing required key \'Bucket\' in params\n* MissingRequiredParameter: '
          + 'Missing required key \'Key\' in params'
        );
        nockDone();
        done();
      }).then(done.fail);
    });
  });
});
