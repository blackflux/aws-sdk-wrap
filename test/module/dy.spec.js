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

  beforeEach(async () => {
    model = buildModel();
    localTable = LocalTable(model);
    await localTable.create();
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing basic logic', () => {
    expect(Object.keys(model)).to.deep.equal([
      'upsert',
      'update',
      'delete',
      'getItem',
      'query',
      'schema'
    ]);
  });

  it('Testing schema', ({ fixture }) => {
    const result = model.schema;
    expect(result).to.deep.equal(fixture('table-schema'));
  });
});
