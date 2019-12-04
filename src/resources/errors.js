// eslint-disable-next-line max-classes-per-file
class SendMessageBatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SendMessageBatchError';
  }
}

class MessageCollisionError extends Error {
  constructor(message) {
    super(JSON.stringify(message));
    this.name = 'MessageCollisionError';
  }
}

module.exports.SendMessageBatchError = SendMessageBatchError;
module.exports.MessageCollisionError = MessageCollisionError;
