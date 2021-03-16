const expect = require('chai').expect;
const { describe } = require('node-tdd');
const { LocalTable, buildModel } = require('../dy-helper');

describe('Testing dy Util', {
  useNock: true,
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
