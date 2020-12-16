const expect = require('chai').expect;
const { describe } = require('node-tdd');
const validateKwargs = require('../../../src/module/dy/validate-kwargs');

describe('Testing validate-kwargs.js', () => {
  let kwargs;
  beforeEach(() => {
    kwargs = {
      name: 'table-name',
      DocumentClient: {}
    };
  });

  it('Testing empty definition', async ({ capture }) => {
    const err = await capture(() => validateKwargs({}));
    expect(err.message).to.equal('ValidationError: "name" is required');
  });

  it('Testing without attributes definition', async ({ capture }) => {
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: "attributes" is required');
  });

  it('Testing attributes incomplete attributes definition', async ({ capture }) => {
    kwargs.attributes = {};
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: "attributes" must have at least 1 key');
  });

  it('Testing invalid partitionKey and sortKey definition in same attribute', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true, sortKey: true }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: "partitionKey" must not exist simultaneously with [sortKey]');
  });

  it('Testing duplicated partitionKey in attribute definition', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true },
      name: { type: 'string', partitionKey: true }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: Duplicated partitionKey definition');
  });

  it('Testing must have zero or one value with sortKey', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true },
      name: { type: 'string', sortKey: true },
      desc: { type: 'string', sortKey: true }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: Duplicated sortKey definition');
  });

  it('Testing must have defined a partitionKey', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string' },
      name: { type: 'string' }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message).to.equal('ValidationError: At least one partitionKey must be defined');
  });

  it('Testing indices (if defined) property must not be empty', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true }
    };
    kwargs.indices = {};
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message)
      .to.equal('ValidationError: "indices" must have at least 1 key');
  });

  it('Testing indices partitionKey must be defined in attributes', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true },
      name: { type: 'string' }
    };
    kwargs.indices = {
      GSI1: { partitionKey: 'idNotExist' }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message)
      .to.equal('ValidationError: Indices values must match with defined attributes');
  });

  it('Testing indices attribute can\'t be used for partitionKey and sortKey', async ({ capture }) => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true }
    };
    kwargs.indices = {
      GSI1: { partitionKey: 'id', sortKey: 'id' }
    };
    const err = await capture(() => validateKwargs(kwargs));
    expect(err.message)
      .to.equal('ValidationError: Can\'t use the same attribute as partitionKey and sortKey');
  });

  it('Testing model schema success minimal definition', () => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true }
    };
    const result = validateKwargs(kwargs);
    expect(result.error).to.equal(undefined);
  });

  it('Testing model schema success with indices', () => {
    kwargs.attributes = {
      id: { type: 'string', partitionKey: true },
      name: { type: 'string', sortKey: true }
    };
    kwargs.indices = {
      GSI1: { partitionKey: 'id', sortKey: 'name' }
    };
    const result = validateKwargs(kwargs);
    expect(result.error).to.equal(undefined);
  });
});
