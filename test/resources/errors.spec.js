const expect = require('chai').expect;
const { desc } = require('node-tdd');
const { SendMessageBatchError } = require('../../src/resources/errors');

desc('Testing errors.js', ({ it }) => {
  it('Testing SendMessageBatchError', () => {
    try {
      throw new SendMessageBatchError('Error Details');
    } catch (err) {
      expect(err).instanceof(SendMessageBatchError);
      expect(err.toString()).to.equal('Error: Send message batch error.\n"Error Details"');
    }
  });
});
