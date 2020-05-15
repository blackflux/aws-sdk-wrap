const sendMessageBatch = require('./sqs/send-message-batch');
const QueueProcessor = require('./sqs/queue-processor');
const { prepareMessage } = require('./sqs/queue-processor/prepare-message');

module.exports.Sqs = ({ call, getService, logger }) => {
  const smb = sendMessageBatch({ call, getService, logger });
  return {
    prepareMessage,
    sendMessageBatch: smb,
    QueueProcessor: QueueProcessor({ sendMessageBatch: smb, logger })
  };
};
