import path from 'path';
import { expect } from 'chai';
import fs from 'smart-fs';
import { describe } from 'node-tdd';
import {
  SQSClient,
  GetQueueAttributesCommand,
  SendMessageBatchCommand
} from '@aws-sdk/client-sqs';
import Index from '../../../src/index.js';
import { getDelaySeconds, prepareMessage } from '../../../src/module/sqs/prepare-message.js';
import * as stepAutoRetry from './queue-processor.spec.js_steps/auto-retry.js';
import * as stepAutoRetryBackoffFn from './queue-processor.spec.js_steps/auto-retry-backoff-fn.js';
import * as stepBadOutput from './queue-processor.spec.js_steps/bad-output.js';
import * as stepDelayStep from './queue-processor.spec.js_steps/delay-step.js';
import * as stepDisallowedOutput from './queue-processor.spec.js_steps/disallowed-output.js';
import * as stepGroupIdStep from './queue-processor.spec.js_steps/group-id-step.js';
import * as stepParallelStep from './queue-processor.spec.js_steps/parallel-step.js';
import * as stepStep1 from './queue-processor.spec.js_steps/step1.js';
import * as stepStep2 from './queue-processor.spec.js_steps/step2.js';
import * as stepStep3 from './queue-processor.spec.js_steps/step3.js';
import * as stepStepAutoRetry from './queue-processor.spec.js_steps/step-auto-retry.js';
import * as stepUrgentMessage from './queue-processor.spec.js_steps/step-urgent-message.js';
import nockReqHeaderOverwrite from '../../req-header-overwrite.js';

describe('Testing QueueProcessor', {
  useNock: true,
  nockReqHeaderOverwrite,
  record: console,
  envVarsFile: 'config.env.yml',
  timestamp: '2020-05-15T19:56:35.713Z'
}, () => {
  let aws;
  let processor;
  let executor;
  let findSymbols;
  beforeEach(() => {
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
    processor = aws.sqs.QueueProcessor({
      queues: {
        one: process.env.QUEUE_URL_ONE,
        two: process.env.QUEUE_URL_TWO
      },
      steps: [
        stepAutoRetry,
        stepAutoRetryBackoffFn,
        stepBadOutput,
        stepDelayStep,
        stepDisallowedOutput,
        stepGroupIdStep,
        stepParallelStep,
        stepStep1,
        stepStep2,
        stepStep3,
        stepStepAutoRetry,
        stepUrgentMessage
      ]
    });
    executor = (records, queue = null) => new Promise((resolve, reject) => {
      processor.handler(queue)({
        Records: records.map((r) => ({
          messageId: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5',
          receiptHandle: 'AQEBBX8nesZEXmkhsmZeyIE8iQAMig7qw...',
          body: JSON.stringify(r),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: String(Date.now()),
            SequenceNumber: '18849496460467696128',
            MessageGroupId: '1',
            SenderId: 'AIDAIO23YVJENQZJOL4VO',
            MessageDeduplicationId: '1',
            ApproximateFirstReceiveTimestamp: '1573251510774'
          },
          messageAttributes: {},
          md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:fifo.fifo',
          awsRegion: 'us-east-2'
        }))
      }, {}, (err, resp) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve(resp);
        }
      });
    });
    findSymbols = (obj, name) => Object.fromEntries(
      Object.getOwnPropertySymbols(obj).map((p) => [String(p), obj[p]])
    );
  });

  it('Visualize', async () => {
    const r = fs.smartWrite(path.join(fs.dirname(import.meta.url), 'digraph.dot'), processor.digraph());
    expect(r).to.equal(false);
  });

  it('Testing bad queue provided', () => {
    expect(() => processor.handler('unknown'))
      .to.throw('Unknown queue "unknown" for handler provided');
  });

  it('Testing bad step for handler', async ({ recorder }) => {
    const err = await executor([{ name: 'group-id-step', meta: 'meta1' }], 'two');
    expect(err).to.deep.equal({
      __error: 'Bad step "group-id-step" for handler "two" provided',
      batchItemFailures: [{ itemIdentifier: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5' }]
    });
    const logs = recorder.get();
    expect(logs.length).to.equal(1);
    expect(logs[0].startsWith([
      'Failed to process all message(s)',
      'Retrying: [{"itemIdentifier":"11d6ee51-4cc7-4302-9e22-7cd8afdaadf5"}]',
      'Error: Error: Bad step "group-id-step" for handler "two" provided at '
    ].join('\n'))).to.equal(true);
  });

  it('Testing ingest', async () => {
    const result = await processor.ingest([{ name: 'step1', meta: 'meta1' }]);
    expect(result).to.equal(undefined);
  });

  it('Testing ingest with groupId', async () => {
    const msg = { name: 'step1', meta: 'meta1' };
    prepareMessage(msg, { groupId: '123' });
    const result = await processor.ingest([msg]);
    expect(result).to.equal(undefined);
  });

  it('Testing ingest with groupIdFunction', async () => {
    const result = await processor.ingest([{ name: 'group-id-step', meta: 'meta1' }]);
    expect(result).to.equal(undefined);
    const r = await executor([{ name: 'group-id-step', meta: 'meta1' }]);
    expect(r).to.deep.equal({ batchItemFailures: [], __next: [] });
  });

  it('Test ingesting into separate queues', async () => {
    const result = await executor([{ __meta: { trace: ['step3 * 2'] }, name: 'step3', meta: 'meta3' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [
        { __meta: { trace: ['step3 * 3'] }, name: 'step1', meta: 'meta1' },
        { __meta: { trace: ['step3 * 3'] }, name: 'step3', meta: 'meta3' }
      ]
    });
  });

  it('Testing ingest for two messages', async () => {
    const result = await processor.ingest([
      { name: 'step1', meta: 'meta1' },
      { name: 'step1', meta: 'meta2' }
    ]);
    expect(result).to.equal(undefined);
  });

  it('Testing urgent message before others', async () => {
    const result = await executor([{ __meta: { trace: ['other'] }, name: 'step-urgent-message' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [
        {
          __meta: { trace: ['step-urgent-message.before()'] },
          name: 'step1',
          meta: 'before'
        },
        {
          __meta: { trace: ['other', 'step-urgent-message'] },
          name: 'step1',
          meta: 'handler'
        }
      ]
    });
    // eslint-disable-next-line no-underscore-dangle
    expect(findSymbols(result.__next[0])).to.deep.equal({ 'Symbol(urgent)': true });
  });

  it('Testing step1 -> [step2]', async () => {
    const result = await executor([{ name: 'step1', meta: 'meta1' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [{
        __meta: { trace: ['step1'] },
        name: 'step2'
      }]
    });
    // eslint-disable-next-line no-underscore-dangle
    expect(findSymbols(result.__next[0])).to.deep.equal({ 'Symbol(delay-seconds)': 10 });
  });

  it('Testing step2 -> []', async () => {
    const result = await executor([{ name: 'step2' }]);
    expect(result).to.deep.equal({ batchItemFailures: [], __next: [] });
  });

  it('Testing bad-output', async ({ recorder }) => {
    const result = await executor([{ name: 'bad-output' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [{
        itemIdentifier: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5'
      }],
      __next: []
    });
    const logs = recorder.get();
    expect(logs.length).to.equal(1);
    expect(logs[0].startsWith([
      'Failed to process (some) message(s)',
      'Retrying: [{"itemIdentifier":"11d6ee51-4cc7-4302-9e22-7cd8afdaadf5"}]',
      'Error(s):',
      '{ Error [ValidationError]: Unexpected/Invalid next step(s) returned for: bad-output [ {'
    ].join('\n'))).to.equal(true);
  });

  it('Testing disallowed-output', async () => {
    const result = await executor([{ name: 'disallowed-output' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [{
        itemIdentifier: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5'
      }],
      __next: []
    });
  });

  it('Testing unknown-step', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'unknown-step' }]));
    expect(result.message).to.equal('Invalid step provided: unknown-step');
  });

  it('Testing unnamed-step', async ({ capture }) => {
    const result = await capture(() => executor([{}]));
    expect(result.message).to.equal('Received step event that is missing "name" property.');
  });

  it('Testing invalid event format', async ({ capture }) => {
    const result = await capture(() => executor([['element']]));
    expect(result.message).to.equal('Invalid Event Received: ["element"]');
  });

  it('Testing invalid step payload', async () => {
    const result = await executor([{ name: 'step1', unexpected: 'value', meta: 'meta1' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [{
        itemIdentifier: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5'
      }],
      __next: []
    });
  });

  it('Testing multiple records (success)', async ({ recorder }) => {
    const result = await executor([
      { name: 'parallel-step', meta: 'A' },
      { name: 'parallel-step', meta: 'B' }
    ]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [
        { __meta: { trace: ['parallel-step.after()'] }, name: 'parallel-step', meta: 'A' },
        { __meta: { trace: ['parallel-step.after()'] }, name: 'parallel-step', meta: 'B' }
      ]
    });
    expect(recorder.get()).to.deep.equal([[
      { name: 'parallel-step', meta: 'A' },
      { name: 'parallel-step', meta: 'B' }
    ]]);
  });

  it('Testing timeout error', async () => {
    const result = await executor([{ name: 'delay-step', delay: 2000 }]);
    expect(result).to.deep.equal({
      batchItemFailures: [{
        itemIdentifier: '11d6ee51-4cc7-4302-9e22-7cd8afdaadf5'
      }],
      __next: []
    });
  });

  it('Testing timeout ok', async () => {
    const result = await executor([{ name: 'delay-step', delay: 500 }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: []
    });
  });

  it('Test auto retry', async ({ recorder }) => {
    const result = await executor([{ name: 'auto-retry' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [{
        name: 'auto-retry',
        __meta: {
          failureCount: 1,
          timestamp: '2020-05-15T19:56:35.713Z',
          trace: ['auto-retry']
        }
      }]
    });
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (from step)', async ({ recorder }) => {
    const result = await executor([{ name: 'step-auto-retry' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [{
        name: 'step-auto-retry',
        __meta: {
          failureCount: 1,
          timestamp: '2020-05-15T19:56:35.713Z',
          trace: ['step-auto-retry']
        }
      }]
    });
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (backoff)', async ({ recorder }) => {
    const retrySettings = { backoffInSec: 60 };
    const result = await executor([{ name: 'auto-retry', retrySettings }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [{
        name: 'auto-retry',
        retrySettings,
        __meta: {
          failureCount: 1,
          timestamp: '2020-05-15T19:56:35.713Z',
          trace: ['auto-retry']
        }
      }]
    });
    // eslint-disable-next-line no-underscore-dangle
    expect(findSymbols(result.__next[0])).to.deep.equal({ 'Symbol(delay-seconds)': 60 });
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (backoff function)', async ({ recorder }) => {
    const result = await executor([{ name: 'auto-retry-backoff-fn' }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: [{
        name: 'auto-retry-backoff-fn',
        __meta: {
          failureCount: 1,
          timestamp: '2020-05-15T19:56:35.713Z',
          trace: ['auto-retry-backoff-fn']
        }
      }]
    });
    // eslint-disable-next-line no-underscore-dangle
    expect(findSymbols(result.__next[0])).to.deep.equal({ 'Symbol(delay-seconds)': 10 });
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (retry fail)', async ({ recorder }) => {
    const result = await executor([{
      name: 'auto-retry',
      __meta: {
        failureCount: 9,
        timestamp: '2020-05-15T19:56:35.713Z'
      }
    }, {
      name: 'auto-retry',
      retrySettings: {
        maxAgeInSec: 60
      },
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:55:35.712Z'
      }
    }]);
    expect(result).to.deep.equal({
      batchItemFailures: [],
      __next: []
    });
    expect(recorder.get()).to.deep.equal([
      'Permanent Retry Failure\n{'
      + '"limits":{"maxFailureCount":10,"maxAgeInSec":9007199254740991},'
      + '"meta":{"failureCount":10,"timestamp":"2020-05-15T19:56:35.713Z"},'
      + '"payload":{"name":"auto-retry"}}',
      'Permanent Retry Failure\n{'
      + '"limits":{"maxFailureCount":10,"maxAgeInSec":60},'
      + '"meta":{"failureCount":2,"timestamp":"2020-05-15T19:55:35.712Z"},'
      + '"payload":{"name":"auto-retry","retrySettings":{"maxAgeInSec":60}}}'
    ]);
  });

  it('Test auto retry (timeout fail)', async ({ recorder }) => {
    const result = await executor([{
      name: 'auto-retry',
      retrySettings: {
        maxAgeInSec: 60
      },
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:55:35.712Z'
      }
    }]);
    expect(result).to.deep.equal({ batchItemFailures: [], __next: [] });
    expect(recorder.get()).to.deep.equal([
      'Permanent Retry Failure\n{'
      + '"limits":{"maxFailureCount":10,"maxAgeInSec":60},'
      + '"meta":{"failureCount":2,"timestamp":"2020-05-15T19:55:35.712Z"},'
      + '"payload":{"name":"auto-retry","retrySettings":{"maxAgeInSec":60}}}'
    ]);
  });

  it('Testing multiple records (error)', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'step1' }, { name: 'step1' }]));
    expect(result.message)
      .to.equal('SQS mis-configured. Parallel processing not supported for: step1');
  });

  it('Testing setting delay on message', async () => {
    const msg = { name: 'step1' };
    aws.sqs.prepareMessage(msg, { delaySeconds: 10 });
    expect(getDelaySeconds(msg)).to.equal(10);
  });

  it('Testing multi prepare message error', async ({ capture }) => {
    const msg = { name: 'step1' };
    aws.sqs.prepareMessage(msg, { urgent: false });
    expect(() => aws.sqs.prepareMessage(msg, { urgent: true }))
      .to.throw('Cannot redefine property: Symbol(urgent)');
  });

  it('Testing empty setting on message', async () => {
    const msg = { name: 'step1' };
    aws.sqs.prepareMessage(msg, {});
    expect(getDelaySeconds(msg)).to.equal(undefined);
  });
});
