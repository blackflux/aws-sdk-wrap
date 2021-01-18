const expect = require('chai').expect;
const { DocumentClient } = require('aws-sdk').DynamoDB;
const { describe } = require('node-tdd');
const createModel = require('../../../src/module/dy/create-model');

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
          sortKey: 'name'
        }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });
});
