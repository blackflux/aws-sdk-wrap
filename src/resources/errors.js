class SendMessageBatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SendMessageBatchError';
  }
}

module.exports.SendMessageBatchError = SendMessageBatchError;
