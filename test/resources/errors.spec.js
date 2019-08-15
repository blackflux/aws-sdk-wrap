const expect = require('chai').expect;
const { SendMessageBatchError } = require('../../src/resources/errors');

describe('Testing errors.js', () => {
  it('Testing SendMessageBatchError', () => {
    try {
      throw new SendMessageBatchError('Error Details');
    } catch (err) {
      expect(err).instanceof(SendMessageBatchError);
      expect(err.toString()).to.equal('Error: Send message batch error.\n"Error Details"');
    }
  });
});
