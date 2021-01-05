const expect = require('chai').expect;
const { describe } = require('node-tdd');
const Index = require('../../../src/index');
const GetDeadLetterQueueUrl = require('../../../src/module/sqs/get-dead-letter-queue-url');

describe('Testing getDeadLetterQueueUrl', {
  useNock: true,
  record: console,
  envVarsFile: 'config.env.yml'
}, () => {
  let aws;
  let getDeadLetterQueueUrl;
  before(() => {
    aws = Index({ logger: console });
    getDeadLetterQueueUrl = GetDeadLetterQueueUrl({ call: aws.call });
  });

  it('Testing getDeadLetterQueueUrl', async () => {
    const r = await getDeadLetterQueueUrl(process.env.QUEUE_URL_ONE);
    expect(r).to.equal('https://sqs.us-west-2.amazonaws.com/123456789012/queueName');
  });
});
