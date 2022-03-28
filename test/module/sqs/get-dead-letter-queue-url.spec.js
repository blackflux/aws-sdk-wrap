import { expect } from 'chai';
import { describe } from 'node-tdd';
import AWS from 'aws-sdk';
import Index from '../../../src/index.js';
import GetDeadLetterQueueUrl from '../../../src/module/sqs/get-dead-letter-queue-url.js';

describe('Testing getDeadLetterQueueUrl', {
  useNock: true,
  record: console,
  envVarsFile: 'config.env.yml'
}, () => {
  let aws;
  let getDeadLetterQueueUrl;
  before(() => {
    aws = Index({
      logger: console,
      services: {
        sqs: AWS.SQS
      }
    });
    getDeadLetterQueueUrl = GetDeadLetterQueueUrl({ call: aws.call });
  });

  it('Testing getDeadLetterQueueUrl', async () => {
    const r = await getDeadLetterQueueUrl(process.env.QUEUE_URL_ONE);
    expect(r).to.equal('https://sqs.us-west-2.amazonaws.com/123456789012/queueName');
  });
});
