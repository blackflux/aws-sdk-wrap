export default ({ call }) => async (queueUrl) => {
  const result = await call('sqs:getQueueAttributes', {
    QueueUrl: queueUrl,
    AttributeNames: ['RedrivePolicy']
  });
  const {
    region,
    accountId,
    queueName
  } = /"arn:aws:sqs:(?<region>[^:]+):(?<accountId>[\d]+):(?<queueName>[^"]+)"/g
    .exec(result.Attributes.RedrivePolicy).groups;
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
};
