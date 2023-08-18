import { expect } from 'chai';
import { describe } from 'node-tdd';
import unmarshall from '../../../src/module/dy/unmarshall.js';

describe('Testing unmarshall.js', () => {
  it('Unmarshalling a set', ({ fixture }) => {
    const raw = fixture('raw');
    const output = unmarshall(raw);
    const expected = fixture('expected');
    expect(output).to.deep.equal(expected);
  });
});
