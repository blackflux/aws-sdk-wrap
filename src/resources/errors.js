class SendMessageBatchError extends Error {
  constructor(message) {
    super();
    this.name = 'SendMessageBatchError';
    this.message = message;
  }
}

module.exports.SendMessageBatchError = SendMessageBatchError;
