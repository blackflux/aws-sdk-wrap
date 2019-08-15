const path = require('path');
const expect = require('chai').expect;
const nockBack = require('nock').back;
const index = require('./../../src/index');
const helper = require('../helper');
const { SendMessageBatchError } = require('../../src/resources/errors');

describe('Testing sqs util', () => {
  let aws;
  before(() => {
    helper.before();
    aws = index();
    nockBack.setMode('record');
    nockBack.fixtures = path.join(__dirname, '..', '__cassettes', 'util', 'sqs');
  });

  after(() => helper.after());

  describe('Testing sendMessageBatch', () => {
    it('Testing send message success', (done) => {
      nockBack('sendMessageSuccess.json_recording.json', async (nockDone) => {
        const result = await aws.sqs.sendMessageBatch(
          [
            {
              type: 'discover',
              data:
                {
                  propertyId: '706a95c1-0001-4e35-af8c-e5227976b607',
                  integrationId: 'f578b003-6497-4fd0-b354-f977e0ee9742',
                  hour: '2018-10-25T20:00:00.000Z'
                }
            }
          ],
          process.env.QUEUE_URL
        );
        expect(result).to.deep.equal(
          [
            [
              {
                ResponseMetadata: {
                  RequestId: 'a8b4a121-1f5c-562e-b28d-f54f44cd7572'
                },
                Successful: [
                  {
                    Id: '519997180f76e285948227ee48ab2e823098231f',
                    MessageId: '44310b3a-4ccb-4221-8687-815993d27551',
                    MD5OfMessageBody: 'e9a9e8b948b2b798f9c680b5ff0cec0a'
                  }
                ],
                Failed: []
              }
            ]
          ]
        );
        nockDone();
        done();
      });
    });

    it('Testing send message error retry', (done) => {
      nockBack('sendMessageErrorRetry.json_recording.json', async (nockDone) => {
        const result = await aws.sqs.sendMessageBatch(
          [
            {
              type: 'webhook',
              url: 'https://some-url.com/path',
              meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
              event: {
                name: 'event_name'
              }
            }
          ],
          process.env.QUEUE_URL
        );
        expect(result).to.deep.equal(
          [
            [
              {
                ResponseMetadata: {
                  RequestId: 'b4f56dbc-037a-5147-8dcd-38068125b74b'
                },
                Successful: [],
                Failed: [
                  {
                    Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
                    SenderFault: false,
                    Code: 'InternalError'
                  }
                ]
              },
              {
                ResponseMetadata: {
                  RequestId: '2f332d0a-9d78-594e-8e94-78b01f67a165'
                },
                Successful: [
                  {
                    Id: 'd7967cdc826c420f2482b9bac6b10b73fb156efc',
                    MessageId: 'e555abcb-d677-41ce-a3cd-022e2d94cad4',
                    MD5OfMessageBody: '90cfad0c5a2d7b4f32be02659214aaba'
                  }
                ],
                Failed: []
              }
            ]
          ]
        );
        nockDone();
        done();
      });
    });

    it('Testing empty messages', () => {
      nockBack('emptyMessages.json_recording.json', async (nockDone) => {
        const result = await aws.sqs.sendMessageBatch(
          [],
          process.env.QUEUE_URL
        );
        expect(result).to.deep.equal([]);
        nockDone();
      });
    });

    it('Testing Send message batch error', (done) => {
      nockBack('sendMessageBatchError.json_recording.json', async (nockDone) => {
        try {
          await aws.sqs.sendMessageBatch(
            [
              {
                type: 'webhook',
                url: 'https://some-url.com/path',
                meta: 'c53be1ec6a664cb0820aa5fa8b9915ea',
                event: {
                  name: 'event_name'
                }
              }
            ],
            process.env.QUEUE_URL
          );
        } catch (err) {
          expect(err).instanceof(SendMessageBatchError);
          nockDone();
          done();
        }
      });
    });
  });
});
