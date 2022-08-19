import crypto from 'crypto';

export default ({ Model }) => (lockTable, {
  owner = 'aws-sdk-wrap-lock-manager',
  leaseDurationMs = 10000
} = {}) => {
  let mdl;
  const mkModel = () => {
    if (mdl === undefined) {
      mdl = Model({
        name: lockTable,
        attributes: {
          id: { type: 'string', partitionKey: true },
          guid: { type: 'string' },
          leaseDurationMs: { type: 'number' },
          lockAcquiredTimeUnixMs: { type: 'number' },
          owner: { type: 'string' }
        }
      });
    }
    return mdl;
  };
  return {
    _model: mkModel,
    lock: async (lockName) => {
      const model = mkModel();
      const nowInMs = new Date() / 1;
      const lockResult = await model.createOrReplace({
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
      if (lockResult === 'ConditionalCheckFailedException') {
        const err = new Error('Failed to acquire lock.');
        err.code = 'FailedToAcquireLock';
        throw err;
      }
      return {
        lock: lockResult,
        release: async () => {
          const releaseResult = await model.delete({
            id: lockName
          }, {
            conditions: { attr: 'guid', eq: lockResult?.item?.guid },
            expectedErrorCodes: ['ConditionalCheckFailedException']
          });
          if (releaseResult === 'ConditionalCheckFailedException') {
            const err = new Error('Failed to release lock.');
            err.code = 'FailedToReleaseLock';
            throw err;
          }
          return releaseResult;
        }
      };
    }
  };
};
