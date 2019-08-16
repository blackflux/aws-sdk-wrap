class SendMessageBatchError extends Error {
  constructor(details) {
    super('Send message batch error.');
    this.details = details;
  }

  toString() {
    return `${super.toString()}\n${JSON.stringify(this.details)}`;
  }
}

module.exports.SendMessageBatchError = SendMessageBatchError;
