import { expect } from 'chai';
import { describe } from 'node-tdd';
import { LocalTable, buildModel } from '../dy-helper.js';
import nockReqHeaderOverwrite from '../req-header-overwrite.js';

describe('Testing dy Util', {
  timestamp: '2022-05-17T18:21:22.341Z',
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  envVarsFile: '../default.env.yml'
}, () => {
  let model;
  let localTable;
  let generateTable;

  before(() => {
    generateTable = async ({ extraIndices } = {}) => {
      model = buildModel({ extraIndices });
      localTable = LocalTable(model);
      await localTable.create();
    };
  });

  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing basic logic', async () => {
    await generateTable();
    expect(Object.keys(model)).to.deep.equal([
      'create',
      'createOrModify',
      'createOrReplace',
      'delete',
      'getItem',
      'modify',
      'query',
      'replace',
      'scan',
      'schema'
    ]);
  });

  it('Testing schema', async ({ fixture }) => {
    await generateTable();
    const result = model.schema;
    expect(result).to.deep.equal(fixture('table-schema'));
  });

  it('Testing schema with ProjectionTypes', async ({ fixture }) => {
    await generateTable({
      extraIndices: {
        projectionTypeKeysOnlyIndex: {
          partitionKey: 'age',
          sortKey: 'id',
          projectionType: 'KEYS_ONLY'
        },
        projectionTypeIncludeIndex: {
          partitionKey: 'slug',
          nonKeyAttributes: ['age'],
          projectionType: 'INCLUDE'
        }
      }
    });
    const result = model.schema;
    expect(result).to.deep.equal(fixture('table-schema-projection-types'));
  });
});
