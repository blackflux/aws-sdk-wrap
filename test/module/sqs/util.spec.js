const expect = require('chai').expect;
const { describe } = require('node-tdd');
const index = require('../../../src/index');
const Util = require('../../../src/module/sqs/util');

describe('Testing util', {
  useNock: true,
  record: console,
  envVarsFile: 'config.env.yml'
}, () => {
  let aws;
  let util;
  before(() => {
    aws = index({ logger: console });
    util = Util({ call: aws.call });
  });

  it('Testing getDeadLetterQueueUrl', async () => {
    const r = await util.getDeadLetterQueueUrl(process.env.QUEUE_URL_ONE);
    expect(r).to.equal('https://sqs.us-west-2.amazonaws.com/123456789012/queueName');
  });
});
