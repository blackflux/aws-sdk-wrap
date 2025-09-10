import { expect } from 'chai';
import { describe } from 'node-tdd';
import { findCycles, getCycleLength } from '../../../../src/module/sqs/queue-processor/trace.js';

describe('Testing trace.js', () => {
  describe('Testing findCycles', () => {
    it('Testing bananarama', async () => {
      const trace = 'bananarama'.split('');
      const r = findCycles(trace);
      expect(r).to.deep.equal({ 'a,n': [1, 3], 'n,a': [2, 4] });
    });

    it('Testing ABCABCABC', async () => {
      const trace = 'ABCABCABC'.split('');
      const r = findCycles(trace);
      expect(r).to.deep.equal({ 'A,B,C': [0, 3, 6], 'B,C,A': [1, 4], 'C,A,B': [2, 5] });
    });

    it('Testing aaabbc', async () => {
      const trace = 'aaabbc'.split('');
      const r = findCycles(trace);
      expect(r).to.deep.equal({ a: [0, 1, 2], b: [3, 4] });
    });
  });

  describe('Testing getCycleLength', () => {
    it('Testing basic', async () => {
      const trace = ['a * 3', 'b * 2', 'a * 3', 'b * 2', 'c'];
      const r = getCycleLength(trace);
      expect(r).to.equal(10);
    });

    it('Testing long', async () => {
      const trace = 'aaabbbcccaaabbbcccaaabbbcccaaabbbcccaaabbbcccaaabbbcccaaabbbcccaaabbbcccaaabbbccc'.split('');
      const r = getCycleLength(trace);
      expect(r).to.equal(81);
    });

    it('Testing single entry', async () => {
      const trace = ['a'];
      const r = getCycleLength(trace);
      expect(r).to.equal(0);
    });
  });
});
