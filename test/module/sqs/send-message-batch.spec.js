const expect = require('chai').expect;
const { describe } = require('node-tdd');
const index = require('../../../src/index');
const { SendMessageBatchError } = require('../../../src/resources/errors');

describe('Testing sendMessageBatch', {
  useNock: true,
  record: console,
  envVarsFile: 'config.env.yml'
}, () => {
  let aws;
  before(() => {
    aws = index({ logger: console });
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
      queueUrl: process.env.QUEUE_URL
    });
    expect(result).to.deep.equal([[{
      ResponseMetadata: {
        RequestId: 'a8b4a121-1f5c-562e-b28d-f54f44cd7572'
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
      queueUrl: process.env.QUEUE_URL
    });
    expect(result).to.deep.equal([[{
      ResponseMetadata: {
        RequestId: 'b4f56dbc-037a-5147-8dcd-38068125b74b'
      },
      Successful: [],
      Failed: [{
        Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
        SenderFault: false,
        Code: 'InternalError'
      }]
    },
    {
      ResponseMetadata: {
        RequestId: '2f332d0a-9d78-594e-8e94-78b01f67a165'
      },
      Successful: [{
        Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
        MessageId: 'e555abcb-d677-41ce-a3cd-022e2d94cad4',
        MD5OfMessageBody: '90cfad0c5a2d7b4f32be02659214aaba'
      }],
      Failed: []
    }]]);
    expect(recorder.get()).to.deep.equal([
      'Failed to submit (some) message(s)\nRetrying: '
      + '[(Id=d7967cdc826c420f2482b9bac6b10b73fb156efc, MD5=90cfad0c5a2d7b4f32be02659214aaba)]'
    ]);
  });

  it('Testing empty messages', async () => {
    const result = await aws.sqs.sendMessageBatch({ messages: [], queueUrl: process.env.QUEUE_URL });
    expect(result).to.deep.equal([]);
  });

  it('Testing Send message batch error', async () => {
    try {
      await aws.sqs.sendMessageBatch({
        messages: [{
          type: 'webhook',
          url: 'https://some-url.com/path',
          meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
          event: {
            name: 'event_name'
          }
        }],
        queueUrl: process.env.QUEUE_URL,
        maxRetries: 1
      });
    } catch (err) {
      expect(err).instanceof(SendMessageBatchError);
    }
  });

  it('Testing maxDelaySeconds option', async () => {
    const result = await aws.sqs.sendMessageBatch({
      messages: [{
        action: 'delete',
        type: 'collection',
        target: '00133a96-01b3-420b-aa4b-68bc84d88b67'
      }],
      queueUrl: process.env.QUEUE_URL,
      delaySeconds: 5
    });
    expect(result).to.deep.equal([[{
      ResponseMetadata: {
        RequestId: '8d1d8e98-dc7e-5fc2-9c83-db8791125e19'
      },
      Successful: [{
        Id: 'e6e5e4a0d0b12e1a085cd0d9b6388a0d0a0b2f79',
        MessageId: '8085f0e3-a423-447e-9c89-3463acc149ef',
        MD5OfMessageBody: '5e44aadb9678e3604d5dbee0be04c4e4'
      }],
      Failed: []
    }]]);
  });
});
