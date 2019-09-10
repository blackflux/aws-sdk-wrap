const sendMessageBatch = require('./sqs/send-message-batch');

module.exports = ({ call, getService, logger }) => ({
  sendMessageBatch: sendMessageBatch({ call, getService, logger })
});
