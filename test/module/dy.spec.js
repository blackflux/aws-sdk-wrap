const expect = require('chai').expect;
const { describe } = require('node-tdd');
const Index = require('../../src');
const DyUtil = require('../../src/module/dy');

describe('Testing dy Util', {}, () => {
  let Table;
  beforeEach(() => {
    const index = Index({ config: { maxRetries: 0 } });
    Table = (opts = {}) => DyUtil({
      call: index.call,
      logger: null,
      getService: index.get
    }).Table(opts);
  });

  it('Testing basic logic', () => {
    const table = Table({
      name: 'some-table',
      attributes: {
        id: { partitionKey: true }
      }
    });
    expect(Object.keys(table)).to.deep.equal([
      'schema',
      'update',
      'get',
      'genSchema'
    ]);
  });
});
