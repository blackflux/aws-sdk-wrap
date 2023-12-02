import { expect } from 'chai';
import { describe } from 'node-tdd';
import { GetQueueAttributesCommand, SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import Index from '../../../src/index.js';
import { MessageCollisionError, SendMessageBatchError } from '../../../src/resources/errors.js';
import nockReqHeaderOverwrite from '../../req-header-overwrite.js';

describe('Testing sendMessageBatch', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  record: console,
  envVarsFile: 'config.env.yml'
}, () => {
  let aws;
  before(() => {
    aws = Index({
      logger: console,
      services: {
        SQS: SQSClient,
        'SQS:CMD': {
          GetQueueAttributesCommand,
          SendMessageBatchCommand
        }
      }
    });
  });

  it('Testing send message success', async () => {
    const result = await aws.sqs.sendMessageBatch({
      messages: [{
        type: 'discover',
        data: {
          propertyId: '706a95c1-0001-4e35-af8c-e5227976b607',
          integrationId: 'f578b003-6497-4fd0-b354-f977e0ee9742',
          hour: '2018-10-25T20:00:00.000Z'
        }
      }],
      queueUrl: process.env.QUEUE_URL_ONE
    });
    expect(result).to.deep.equal([[{
      $metadata: {
        httpStatusCode: 200,
        attempts: 1,
        totalRetryDelay: 0,
        cfId: undefined,
        extendedRequestId: undefined,
        requestId: undefined
      },
      Successful: [{
        Id: '519997180f76e285948227ee48ab2e823098231f',
        MessageId: '44310b3a-4ccb-4221-8687-815993d27551',
        MD5OfMessageBody: 'e9a9e8b948b2b798f9c680b5ff0cec0a'
      }],
      Failed: []
    }]]);
  });

  it('Testing send message error retry', async ({ recorder }) => {
    const result = await aws.sqs.sendMessageBatch({
      messages: [{
        type: 'webhook',
        url: 'https://some-url.com/path',
        meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
        event: {
          name: 'event_name'
        }
      }],
      queueUrl: process.env.QUEUE_URL_ONE
    });
    expect(result).to.deep.equal([[
      {
        $metadata: {
          httpStatusCode: 200,
          attempts: 1,
          totalRetryDelay: 0,
          cfId: undefined,
          extendedRequestId: undefined,
          requestId: undefined
        },
        Failed: [{
          Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
          SenderFault: false,
          Code: 'InternalError'
        }]
      },
      {
        $metadata: {
          httpStatusCode: 200,
          attempts: 1,
          totalRetryDelay: 0,
          cfId: undefined,
          extendedRequestId: undefined,
          requestId: undefined
        },
        Successful: [{
          Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
          MessageId: '5b6c64ce-37de-47bf-aad4-fc483c86c1e9',
          MD5OfMessageBody: '90cfad0c5a2d7b4f32be02659214aaba'
        }],
        Failed: []
      }]]);
    expect(recorder.get()).to.deep.equal([
      'Failed to submit (some) message(s)\nRetrying: '
      + '[( Id = d7967cdc826c420f2482b9bac6b10b73fb156efc , MD5 = 90cfad0c5a2d7b4f32be02659214aaba )]'
    ]);
  });

  it('Testing empty messages', async () => {
    const result = await aws.sqs.sendMessageBatch({ messages: [], queueUrl: process.env.QUEUE_URL_ONE });
    expect(result).to.deep.equal([]);
  });

  it('Testing Send message batch error', async ({ capture }) => {
    const err = await capture(() => aws.sqs.sendMessageBatch({
      messages: [{
        type: 'webhook',
        url: 'https://some-url.com/path',
        meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
        event: {
          name: 'event_name'
        }
      }],
      queueUrl: process.env.QUEUE_URL_ONE,
      maxRetries: 1
    }));
    expect(err).instanceof(SendMessageBatchError);
    expect(err.context).to.deep.equal({
      failedMessages: [
        {
          type: 'webhook',
          url: 'https://some-url.com/path',
          meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
          event: {
            name: 'event_name'
          }
        }
      ]
    });
  });

  it('Testing maxDelaySeconds option', async () => {
    const result = await aws.sqs.sendMessageBatch({
      messages: [{
        action: 'delete',
        type: 'collection',
        target: '00133a96-01b3-420b-aa4b-68bc84d88b67'
      }],
      queueUrl: process.env.QUEUE_URL_ONE,
      delaySeconds: 5
    });
    expect(result).to.deep.equal([[{
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
        totalRetryDelay: 0
      },
      Successful: [{
        Id: 'dc616406d8b80239f3fb6b0f7a9a3c1a360f0d46',
        MessageId: '8085f0e3-a423-447e-9c89-3463acc149ef',
        MD5OfMessageBody: '5e44aadb9678e3604d5dbee0be04c4e4'
      }],
      Failed: []
    }]]);
  });

  it('Testing message collision error', async ({ capture }) => {
    const err = await capture(() => aws.sqs.sendMessageBatch({
      messages: [
        {
          action: 'delete',
          type: 'collection',
          target: '00133a96-01b3-420b-aa4b-68bc84d88b67'
        },
        {
          action: 'delete',
          type: 'collection',
          target: '00133a96-01b3-420b-aa4b-68bc84d88b67'
        }
      ],
      queueUrl: process.env.QUEUE_URL_ONE
    }));
    expect(err).instanceof(MessageCollisionError);
  });
});
