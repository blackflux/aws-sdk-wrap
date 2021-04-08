const expect = require('chai').expect;
const { describe } = require('node-tdd');
const {
  validateNoParams,
  validateOneParam,
  validateTwoParams,
  validateAsync
} = require('./uncalled-validate-fns');

describe('Testing uncalled-validate-fns.js', () => {
  it('Testing validateNoParams is called', () => {
    expect(validateNoParams()).to.equal(true);
  });

  it('Testing validateOneParam is called', () => {
    expect(validateOneParam('one')).to.equal(true);
  });

  it('Testing validateTwoParams is called', () => {
    expect(validateTwoParams('one', 'two')).to.equal(true);
  });

  it('Testing validateAsync is called', async () => {
    expect(await validateAsync('one')).to.equal(true);
  });
});
