const sendMessageBatch = require('./sqs/send-message-batch');
const QueueProcessor = require('./sqs/queue-processor');

module.exports = ({ call, getService, logger }) => {
  const smb = sendMessageBatch({ call, getService, logger });
  return {
    sendMessageBatch: smb,
    QueueProcessor: QueueProcessor({ sendMessageBatch: smb })
  };
};
