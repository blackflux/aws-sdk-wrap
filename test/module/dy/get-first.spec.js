import { expect } from 'chai';
import { describe } from 'node-tdd';
import getFirst from '../../../src/module/dy/get-first.js';

describe('Testing get-first.js', () => {
  let fn;
  before(() => {
    fn = ([k, v]) => v.key === true;
  });

  it('Testing key present and true', () => {
    const gf = getFirst({
      id: { key: true },
      other: { type: 'string' }
    }, fn);
    expect(gf).to.equal('id');
  });

  it('Testing key present and false', () => {
    const gf = getFirst({
      id: { key: false },
      other: { type: 'string' }
    }, fn);
    expect(gf).to.equal(undefined);
  });

  it('Testing no key present', () => {
    const gf = getFirst({
      other: { type: 'string' }
    }, fn);
    expect(gf).to.equal(undefined);
  });
});
