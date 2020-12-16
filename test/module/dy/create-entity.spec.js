const expect = require('chai').expect;
const { describe } = require('node-tdd');
const DocumentClient = require('aws-sdk').DynamoDB.DocumentClient;
const createEntity = require('../../../src/module/dy/create-entity');

describe('Testing create-entity.js', () => {
  it('Testing basic logic', () => {
    const r = createEntity({
      name: 'table-name',
      attributes: {
        id: { type: 'string', partitionKey: true },
        name: { type: 'string' }
      },
      indices: {
        targetIndex: {
          // todo: this should error the way that is is
          partitionKey: 'target',
          sortKey: 'type'
        }
      },
      DocumentClient: new DocumentClient()
    });
    expect(Object.keys(r)).to.deep.equal(['entity', 'schema']);
  });
});
