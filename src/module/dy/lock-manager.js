import crypto from 'crypto';

export default ({ Model }) => (lockTable, {
  owner = 'aws-sdk-wrap-lock-manager',
  leaseDurationMs = 10000
} = {}) => {
  const model = Model({
    name: lockTable,
    attributes: {
      id: { type: 'string', partitionKey: true },
      guid: { type: 'string' },
      leaseDurationMs: { type: 'number' },
      lockAcquiredTimeUnixMs: { type: 'number' },
      owner: { type: 'string' }
    }
  });
  return {
    _model: model,
    lock: async (lockName) => {
      const nowInMs = new Date() / 1;
      const lock = await model.createOrReplace({
        id: lockName,
        guid: crypto.randomUUID(),
        leaseDurationMs,
        lockAcquiredTimeUnixMs: nowInMs,
        owner
      }, {
        conditions: [
          { attr: 'id', exists: false },
          { or: true, attr: 'lockAcquiredTimeUnixMs', lt: nowInMs - leaseDurationMs }
        ],
        expectedErrorCodes: ['ConditionalCheckFailedException']
      });
      if (lock === 'ConditionalCheckFailedException') {
        throw new Error('Failed to acquire lock.');
      }
      return {
        lock,
        release: async () => {
          const releasedResult = await model.delete({
            id: lockName
          }, {
            conditions: { attr: 'guid', eq: lock?.item?.guid },
            expectedErrorCodes: ['ConditionalCheckFailedException']
          });
          if (releasedResult === 'ConditionalCheckFailedException') {
            throw new Error('Failed to release lock.');
          }
          return true;
        }
      };
    }
  };
};
