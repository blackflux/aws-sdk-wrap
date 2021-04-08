const expect = require('chai').expect;
const { describe } = require('node-tdd');
const validateKwargs = require('../../../src/module/dy/validate-kwargs');
const {
  validateNoParams,
  validateOneParam,
  validateTwoParams,
  validateAsync
} = require('../../helper/uncalled-validate-fns');

describe('Testing validate-kwargs.js', () => {
  let exec;
  let generateKwargs;

  before(() => {
    exec = (kwargs) => {
      let result;
      try {
        result = validateKwargs(kwargs);
      } catch (err) {
        result = err;
      }
      return result;
    };
    generateKwargs = ({ attributes = null, indices = null } = {}) => ({
      name: 'table-name',
      ...(attributes === null ? {} : { attributes }),
      ...(indices === null ? {} : { indices }),
      DocumentClient: {}
    });
  });

  it('Testing empty definition', () => {
    const error = exec({});
    expect(error.message).to.equal('ValidationError: "name" is required');
  });

  it('Testing without attributes definition', () => {
    const kwargs = generateKwargs();
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "attributes" is required');
  });

  it('Testing incomplete attributes definition', () => {
    const kwargs = generateKwargs({ attributes: {} });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "attributes" must have at least 1 key');
  });

  it('Testing attribute cannot be defined as partitionKey and sortKey simultaneously', () => {
    const kwargs = generateKwargs({
      attributes: { id: { type: 'string', partitionKey: true, sortKey: true } }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "partitionKey" must not exist simultaneously with [sortKey]');
  });

  it('Testing duplicated partitionKey in attributes definition', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', partitionKey: true }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Duplicated partitionKey definition');
  });

  it('Testing duplicated sortKey in attributes definition', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', sortKey: true },
        desc: { type: 'string', sortKey: true }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Duplicated sortKey definition');
  });

  it('Testing partitionKey must be defined in attributes definition', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: At least one partitionKey must be defined');
  });

  it('Testing indices must have at least one defined index', () => {
    const kwargs = generateKwargs({
      attributes: { id: { type: 'string', partitionKey: true } },
      indices: {}
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "indices" must have at least 1 key');
  });

  it('Testing index partitionKey must be defined in attributes', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' }
      },
      indices: { GSI1: { partitionKey: 'idNotExist', sortKey: 'name' } }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Indices values must match with defined attributes');
  });

  it('Testing one index missing partitionKey definition in attributes', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' }
      },
      indices: {
        GSI1: { partitionKey: 'id' },
        GSI2: { partitionKey: 'idNotExist', sortKey: 'name' }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Indices values must match with defined attributes');
  });

  it('Testing index definition cannot use the same attribute for partitionKey and sortKey', () => {
    const kwargs = generateKwargs({
      attributes: { id: { type: 'string', partitionKey: true } },
      indices: { GSI1: { partitionKey: 'id', sortKey: 'id' } }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Cannot use the same attribute for partitionKey and sortKey');
  });

  it('Testing model schema success minimal definition', () => {
    const kwargs = generateKwargs({
      attributes: { id: { type: 'string', partitionKey: true } }
    });
    const result = exec(kwargs);
    expect(result).to.deep.equal(kwargs);
  });

  it('Testing model schema success with indices', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', sortKey: true }
      },
      indices: {
        GSI1: { partitionKey: 'id', sortKey: 'name' },
        GSI2: { partitionKey: 'name' }
      }
    });
    const result = exec(kwargs);
    expect(result).to.deep.equal(kwargs);
  });

  it('Testing attribute validate function', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', validate: validateOneParam }
      }
    });
    const result = exec(kwargs);
    expect(result).to.deep.equal(kwargs);
  });

  it('Testing attribute validate not a function', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', validate: {} }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "attributes.name.validate" must be of type function');
  });

  it('Testing attribute validate with low arity', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', validate: validateNoParams }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "attributes.name.validate" must have an arity of 1');
  });

  it('Testing attribute validate with high arity', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', validate: validateTwoParams }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: "attributes.name.validate" must have an arity of 1');
  });

  it('Testing attribute validate cannot be async', () => {
    const kwargs = generateKwargs({
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string', validate: validateAsync }
      }
    });
    const error = exec(kwargs);
    expect(error.message).to.equal('ValidationError: Validate cannot be asynchronous');
  });
});
