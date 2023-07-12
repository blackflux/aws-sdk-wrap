import { expect } from 'chai';
import { describe } from 'node-tdd';
import createModel from '../../../src/module/dy/create-model.js';
import { validateOneParam } from '../../helper/uncalled-validate-fns.js';
import DocumentClientConstructor from '../../helper/dy-document-client.js';

describe('Testing create-model.js', () => {
  let DocumentClient;
  beforeEach(() => {
    DocumentClient = DocumentClientConstructor();
  });

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
      DocumentClient
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
      DocumentClient
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
      DocumentClient
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
        DocumentClient
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
      DocumentClient
    });
    expect(Object.keys(r)).to.deep.equal(['schema', 'table', 'entity']);
  });
});
