// eslint-disable-next-line max-classes-per-file
export class SendMessageBatchError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'SendMessageBatchError';
    this.context = context;
  }
}

export class MessageConfigurationError extends Error {
  constructor(message, context) {
    super(message);
    this.name = 'MessageConfigurationError';
    this.context = context;
  }
}

export class MessageCollisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MessageCollisionError';
  }
}

export class ModelNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelNotFound';
  }
}

export class ModelAlreadyExists extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelAlreadyExists';
  }
}
