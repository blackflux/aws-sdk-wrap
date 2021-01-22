const expect = require('chai').expect;
const { describe } = require('node-tdd');
const Index = require('../../../src/index');
const { getDelaySeconds, prepareMessage } = require('../../../src/module/sqs/prepare-message');

describe('Testing QueueProcessor', {
  useNock: true,
  record: console,
  envVarsFile: 'config.env.yml',
  timestamp: '2020-05-15T19:56:35.713Z'
}, () => {
  let aws;
  let processor;
  let executor;
  beforeEach(() => {
    aws = Index({ logger: console });
    processor = aws.sqs.QueueProcessor({
      queues: {
        one: process.env.QUEUE_URL_ONE,
        two: process.env.QUEUE_URL_TWO
      },
      stepsDir: `${__filename}_steps`,
      ingestSteps: ['step1', 'step3', 'group-id-step', 'step-urgent-message']
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
  });

  it('Visualize', async () => {
    expect(processor.digraph()).to.deep.equal([
      '# Visualize at http://viz-js.com/',
      'digraph G {',
      '  subgraph cluster_0 {',
      '    label="one";',
      '    style=filled;',
      '    color=lightgrey;',
      '    node [label="node",style=filled,color=white];',
      '    autoRetryBackoffFn [label="auto-retry-backoff-fn"];',
      '    autoRetry [label="auto-retry",color=red];',
      '    badOutput [label="bad-output"];',
      '    delayStep [label="delay-step",color=red];',
      '    disallowedOutput [label="disallowed-output"];',
      '    groupIdStep [label="group-id-step"];',
      '    stepAutoRetry [label="step-auto-retry"];',
      '    stepUrgentMessage [label="step-urgent-message",color=red];',
      '    step1 [label="step1"];',
      '  }',
      '  subgraph cluster_1 {',
      '    label="two";',
      '    style=filled;',
      '    color=lightgrey;',
      '    node [label="node",style=filled,color=white];',
      '    parallelStep [label="parallel-step",color=red,shape=doublecircle];',
      '    step2 [label="step2"];',
      '    step3 [label="step3",shape=doublecircle];',
      '  }',
      '  ',
      '  _ingest [shape=Mdiamond,label=ingest];',
      '  _ingest -> step1;',
      '  _ingest -> step3;',
      '  _ingest -> groupIdStep;',
      '  _ingest -> stepUrgentMessage;',
      '  ',
      '  autoRetryBackoffFn -> autoRetryBackoffFn;',
      '  autoRetry -> autoRetry;',
      '  badOutput -> step2;',
      '  parallelStep -> parallelStep;',
      '  stepAutoRetry -> stepAutoRetry;',
      '  stepUrgentMessage -> step1;',
      '  step1 -> step2;',
      '  step3 -> step1;',
      '  step3 -> step3;',
      '}'
    ]);
  });

  it('Testing bad queue provided', () => {
    expect(() => processor.handler('unknown'))
      .to.throw('Unknown queue "unknown" for handler provided');
  });

  it('Testing bad step for handler', async ({ capture }) => {
    const err = await capture(() => executor([{ name: 'group-id-step', meta: 'meta1' }], 'two'));
    expect(err.message).to.equal('Bad step "group-id-step" for handler "two" provided');
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
    expect(r).to.deep.equal([]);
  });

  it('Test ingesting into separate queues', async () => {
    const result = await executor([{ name: 'step3', meta: 'meta3' }]);
    expect(result).to.deep.equal([
      { name: 'step1', meta: 'meta1' },
      { name: 'step3', meta: 'meta3' }
    ]);
  });

  it('Testing ingest for two messages', async () => {
    const result = await processor.ingest([
      { name: 'step1', meta: 'meta1' },
      { name: 'step1', meta: 'meta2' }
    ]);
    expect(result).to.equal(undefined);
  });

  it('Testing urgent message before others', async () => {
    const result = await executor([{ name: 'step-urgent-message' }]);
    expect(result).to.deep.equal([
      { name: 'step1', meta: 'before' },
      { name: 'step1', meta: 'handler' }
    ]);
  });

  it('Testing step1 -> [step2]', async () => {
    const result = await executor([{ name: 'step1', meta: 'meta1' }]);
    expect(result).to.deep.equal([{ name: 'step2' }]);
  });

  it('Testing step2 -> []', async () => {
    const result = await executor([{ name: 'step2' }]);
    expect(result).to.deep.equal([]);
  });

  it('Testing bad-output', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'bad-output' }]));
    expect(result.message).to.equal(
      'Unexpected/Invalid next step(s) returned for: bad-output '
      + '[\n  {\n    "name" \u001b[31m[1]\u001b[0m: "unknown-step"\n  }\n]'
      + '\n\u001b[31m\n[1] "[0].name" must be [step2]\u001b[0m'
    );
  });

  it('Testing disallowed-output', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'disallowed-output' }]));
    expect(result.message).to.equal('No output allowed for step: disallowed-output');
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

  it('Testing invalid step payload', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'step1', unexpected: 'value', meta: 'meta1' }]));
    expect(result.message).to.equal(
      'Invalid payload received for step: step1 '
      + '{\n  "name": "step1",\n  "meta": "meta1",\n  "unexpected" \u001b[31m[1]\u001b[0m: "value"\n}\n\u001b[31m\n'
      + '[1] "unexpected" is not allowed\u001b[0m'
    );
  });

  it('Testing multiple records (success)', async ({ recorder }) => {
    const result = await executor([
      { name: 'parallel-step', meta: 'A' },
      { name: 'parallel-step', meta: 'B' }
    ]);
    expect(result).to.deep.equal([
      { name: 'parallel-step', meta: 'A' },
      { name: 'parallel-step', meta: 'B' }
    ]);
    expect(recorder.get()).to.deep.equal([[
      { name: 'parallel-step', meta: 'A' },
      { name: 'parallel-step', meta: 'B' }
    ]]);
  });

  it('Testing timeout error', async ({ capture }) => {
    const result = await capture(() => executor([{ name: 'delay-step', delay: 2000 }]));
    expect(result.message).to.deep.equal('Promise "" timed out after 1000 ms');
  });

  it('Testing timeout ok', async () => {
    const result = await executor([{ name: 'delay-step', delay: 500 }]);
    expect(result).to.deep.equal([]);
  });

  it('Test auto retry', async ({ recorder }) => {
    const result = await executor([{ name: 'auto-retry' }]);
    expect(result).to.deep.equal([{
      name: 'auto-retry',
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:56:35.713Z'
      }
    }]);
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (from step)', async ({ recorder }) => {
    const result = await executor([{ name: 'step-auto-retry' }]);
    expect(result).to.deep.equal([{
      name: 'step-auto-retry',
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:56:35.713Z'
      }
    }]);
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (backoff)', async ({ recorder }) => {
    const retrySettings = { backoffInSec: 60 };
    const result = await executor([{ name: 'auto-retry', retrySettings }]);
    expect(result).to.deep.equal([{
      name: 'auto-retry',
      retrySettings,
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:56:35.713Z'
      }
    }]);
    expect(recorder.get()).to.deep.equal([]);
  });

  it('Test auto retry (backoff function)', async ({ recorder }) => {
    const result = await executor([{ name: 'auto-retry-backoff-fn' }]);
    expect(result).to.deep.equal([{
      name: 'auto-retry-backoff-fn',
      __meta: {
        failureCount: 1,
        timestamp: '2020-05-15T19:56:35.713Z'
      }
    }]);
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
    expect(result).to.deep.equal([]);
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
    expect(result).to.deep.equal([]);
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
    aws.sqs.prepareMessage(msg, { delaySeconds: 10 });
    expect(() => aws.sqs.prepareMessage(msg, { delaySeconds: 20 }))
      .to.throw('Cannot redefine property: Symbol(delay-seconds)');
  });

  it('Testing empty setting on message', async () => {
    const msg = { name: 'step1' };
    aws.sqs.prepareMessage(msg, {});
    expect(getDelaySeconds(msg)).to.equal(undefined);
  });
});
