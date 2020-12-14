const SendMessageBatch = require('./sqs/send-message-batch');
const GetDeadLetterQueueUrl = require('./sqs/get-dead-letter-queue-url');
const QueueProcessor = require('./sqs/queue-processor');
const { prepareMessage } = require('./sqs/prepare-message');
const errors = require('./sqs/errors');

module.exports = ({ call, getService, logger }) => {
  const sendMessageBatch = SendMessageBatch({ call, getService, logger });
  const getDeadLetterQueueUrl = GetDeadLetterQueueUrl({ call });
  return {
    prepareMessage,
    errors,
    sendMessageBatch,
    getDeadLetterQueueUrl,
    QueueProcessor: QueueProcessor({
      sendMessageBatch,
      getDeadLetterQueueUrl,
      logger
    })
  };
};
