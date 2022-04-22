import DynamoDBLockClient from 'dynamodb-lock-client';

export default ({ getService, logger }) => (lockTable, {
  owner = 'aws-sdk-wrap-lock-manager',
  leaseDurationMs = 10000,
  heartbeatPeriodMs
} = {}) => {
  let lockClient = null;
  const getLockClient = () => {
    if (lockClient == null) {
      lockClient = new DynamoDBLockClient.FailOpen({
        dynamodb: getService('DynamoDB.DocumentClient'),
        lockTable,
        partitionKey: 'id',
        leaseDurationMs,
        heartbeatPeriodMs,
        trustLocalTime: true,
        owner
      });
    }
    return lockClient;
  };
  return {
    lock: (lockName) => new Promise((resolve, reject) => {
      const client = getLockClient();
      client.acquireLock(lockName, (err, lock) => {
        if (err) {
          reject(err);
        }
        lock.on('error', (error) => Promise.resolve(error)
          .then((e) => logger.info(`Error: Failed to renew heartbeat for lock ${lockName}\n${e}`)));
        resolve({
          release: () => new Promise((res, rej) => {
            lock.release((e) => (e ? rej(e) : res()));
          }),
          fencingToken: lock.fencingToken
        });
      });
    })
  };
};
