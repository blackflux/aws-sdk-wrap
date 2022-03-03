const expect = require('chai').expect;
const { DocumentClient } = require('aws-sdk').DynamoDB;
const { describe } = require('node-tdd');
const createModel = require('../../../src/module/dy/create-model');
const { validateOneParam } = require('../../helper/uncalled-validate-fns');

describe('Testing create-model.js', () => {
  it('Testing basic logic', () => {
    const r = createModel({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' },
        other: { type: 'string' }
      },
      indices: {
        targetIndex: {
          partitionKey: 'id',
          sortKey: 'name',
          projectionType: 'KEYS_ONLY'
        }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });

  it('Testing creation without indices', () => {
    const r = createModel({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' },
        other: { type: 'string' }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });

  it('Testing creation different attribute types', () => {
    const r = createModel({
      name: 'table-name',
      attributes: {
        id: { type: 'number', partitionKey: true },
        binary: { type: 'binary', sortKey: true },
        other: { type: 'string' },
        number: { type: 'number' }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });

  it('Testing attribute not supported for indexing error', () => {
    try {
      createModel({
        name: 'table-name',
        attributes: {
          id: { type: 'map', partitionKey: true },
          binary: { type: 'binary', sortKey: true },
          other: { type: 'string' },
          number: { type: 'number' }
        },
        DocumentClient: new DocumentClient()
      });
    } catch (error) {
      expect(error.message).to.equal('map not supported for indexing');
    }
  });

  it('Testing attribute with validate function', () => {
    const r = createModel({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' },
        other: { type: 'string', validate: validateOneParam }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });

  it('Testing with timestamps attribute', () => {
    const r = createModel({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' }
      },
      timestamps: true,
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });
});
