import { expect } from 'chai';
import { describe } from 'node-tdd';
import {
  validateNoParams,
  validateOneParam,
  validateTwoParams,
  validateAsync
} from './uncalled-validate-fns.js';

describe('Testing uncalled-validate-fns.js', () => {
  it('Testing validateNoParams is called', () => {
    expect(() => validateNoParams()).to.throw('validateNoParams was called.');
  });

  it('Testing validateOneParam is called', () => {
    expect(() => validateOneParam()).to.throw('validateOneParam was called.');
  });

  it('Testing validateTwoParams is called', () => {
    expect(() => validateTwoParams()).to.throw('validateTwoParams was called.');
  });

  it('Testing validateAsync is called', async ({ capture }) => {
    const error = await capture(() => validateAsync());
    expect(error.message).to.equal('validateAsync was called.');
  });
});
