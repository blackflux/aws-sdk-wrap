const expect = require('chai').expect;
const { describe } = require('node-tdd');
const Index = require('../../src');
const Lambda = require('../../src/module/lambda');

describe('Testing lambda Util', {
  useNock: true,
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
        config: { maxRetries: 0 }
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

  it('Dynamic Zero', async () => {
    await scaler(false)();
  });
});
