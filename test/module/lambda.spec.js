import {
  LambdaClient,
  GetAliasCommand,
  DeleteProvisionedConcurrencyConfigCommand,
  PutProvisionedConcurrencyConfigCommand,
  GetProvisionedConcurrencyConfigCommand
} from '@aws-sdk/client-lambda';
import {
  SSMClient,
  GetParameterCommand
} from '@aws-sdk/client-ssm';
import {
  CloudWatchClient,
  GetMetricDataCommand
} from '@aws-sdk/client-cloudwatch';
import { expect } from 'chai';
import { describe } from 'node-tdd';
import Index from '../../src/index.js';
import Lambda from '../../src/module/lambda.js';
import nockReqHeaderOverwrite from '../req-header-overwrite.js';
import retryStrategy from '../helper/retry-strategy.js';

describe('Testing lambda Util', {
  useNock: true,
  nockReqHeaderOverwrite,
  timeout: 10000,
  envVarsFile: '../default.env.yml',
  timestamp: '2022-03-21T21:39:36.492Z'
}, () => {
  let lambda;
  let scaler;

  beforeEach(() => {
    lambda = Lambda({
      call: Index({
        logger: console,
        config: { retryStrategy },
        services: {
          Lambda: LambdaClient,
          'Lambda:CMD': {
            GetAliasCommand,
            DeleteProvisionedConcurrencyConfigCommand,
            PutProvisionedConcurrencyConfigCommand,
            GetProvisionedConcurrencyConfigCommand
          },
          SSM: SSMClient,
          'SSM:CMD': {
            GetParameterCommand
          },
          CloudWatch: CloudWatchClient,
          'CloudWatch:CMD': {
            GetMetricDataCommand
          }
        }
      }).call
    });
    scaler = lambda.FunctionScaler({
      functionName: 'service-search-api-local-dev-apiRouter'
    });
  });

  it('Testing exports', () => {
    expect(Object.keys(lambda)).to.deep.equal([
      'FunctionScaler'
    ]);
  });

  it('Restore Simple', async () => {
    await scaler(true)();
  });

  it('Restore No Alias', async () => {
    await scaler(true)();
  });

  it('Restore Not Restored', async () => {
    await scaler(true)();
  });

  it('Dynamic Simple', async () => {
    await scaler(false)();
  });

  it('Dynamic Disabled', async () => {
    await scaler(false)();
  });

  it('Dynamic Processing', async () => {
    await scaler(false)();
  });

  it('Dynamic Last Update Too Recent', async () => {
    await scaler(false)();
  });

  it('Dynamic Zero', async () => {
    await scaler(false)();
  });
});
