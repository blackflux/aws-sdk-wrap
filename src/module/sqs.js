const sendMessageBatch = require('./sqs/send-message-batch');
const QueueProcessor = require('./sqs/queue-processor');
const { prepareMessage } = require('./sqs/prepare-message');
const errors = require('./sqs/errors');

module.exports.Sqs = ({ call, getService, logger }) => {
  const smb = sendMessageBatch({ call, getService, logger });
  return {
    prepareMessage,
    errors,
    sendMessageBatch: smb,
    QueueProcessor: QueueProcessor({ sendMessageBatch: smb, logger })
  };
};
