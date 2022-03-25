import SendMessageBatch from './sqs/send-message-batch.js';
import GetDeadLetterQueueUrl from './sqs/get-dead-letter-queue-url.js';
import QueueProcessor from './sqs/queue-processor.js';
import { prepareMessage } from './sqs/prepare-message.js';
import * as errors from './sqs/errors.js';

export default ({ call, getService, logger }) => {
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
