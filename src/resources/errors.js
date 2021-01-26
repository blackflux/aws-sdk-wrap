// eslint-disable-next-line max-classes-per-file
class SendMessageBatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SendMessageBatchError';
  }
}
module.exports.SendMessageBatchError = SendMessageBatchError;

class MessageCollisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MessageCollisionError';
  }
}
module.exports.MessageCollisionError = MessageCollisionError;

class ModelNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelNotFound';
  }
}
module.exports.ModelNotFound = ModelNotFound;
