import crypto from 'crypto';

export default ({ Model }) => (ucTable, {
  owner = 'aws-sdk-wrap-uc-manager',
  reserveDurationMs = 15000
} = {}) => {
  let mdl;
  const getModelCached = () => {
    if (mdl === undefined) {
      mdl = Model({
        name: ucTable,
        attributes: {
          id: { type: 'string', partitionKey: true },
          guid: { type: 'string' },
          permanent: { type: 'boolean' },
          reserveDurationMs: { type: 'number' },
          ucReserveTimeUnixMs: { type: 'number' },
          owner: { type: 'string' }
        }
      });
    }
    return mdl;
  };
  return {
    get _model() {
      return getModelCached();
    },
    persist: async (id, force = false) => {
      const model = getModelCached();
      const persistResult = await model.createOrReplace(
        {
          id,
          guid: crypto.randomUUID(),
          permanent: true,
          reserveDurationMs: 0,
          ucReserveTimeUnixMs: Number.MAX_SAFE_INTEGER,
          owner
        },
        (force === true ? {} : {
          conditions: [
            { attr: 'id', exists: false },
            { or: true, attr: 'permanent', eq: false }
          ],
          expectedErrorCodes: ['ConditionalCheckFailedException']
        })
      );
      if (persistResult === 'ConditionalCheckFailedException') {
        const err = new Error('Failed to persist unique constraint.');
        err.code = 'FailedToPersistUniqueConstraint';
        throw err;
      }
      return persistResult;
    },
    delete: async (id) => {
      const model = getModelCached();
      const deleteResult = await model.delete({ id }, {
        conditions: { attr: 'id', exists: true },
        expectedErrorCodes: ['ConditionalCheckFailedException']
      });
      if (deleteResult === 'ConditionalCheckFailedException') {
        const err = new Error('Failed to delete unique constraint.');
        err.code = 'FailedToDeleteUniqueConstraint';
        throw err;
      }
      return deleteResult;
    },
    reserve: async (id) => {
      const model = getModelCached();
      const nowInMs = new Date() / 1;
      const reserveResult = await model.createOrReplace({
        id,
        guid: crypto.randomUUID(),
        reserveDurationMs,
        permanent: false,
        ucReserveTimeUnixMs: nowInMs,
        owner
      }, {
        conditions: [
          { attr: 'id', exists: false },
          { or: true, attr: 'ucReserveTimeUnixMs', lt: nowInMs - reserveDurationMs },
          { or: false, attr: 'permanent', eq: false }
        ],
        expectedErrorCodes: ['ConditionalCheckFailedException']
      });
      if (reserveResult === 'ConditionalCheckFailedException') {
        // todo: we need to know if this is a temporary or permanent failure
        // ...
        const err = new Error('Failed to reserve unique constraint.');
        err.code = 'FailedToReserveUniqueConstraint';
        throw err;
      }
      return {
        reserve: reserveResult,
        release: async () => {
          const releaseResult = await model.delete({
            id
          }, {
            conditions: [
              { attr: 'guid', eq: reserveResult?.item?.guid },
              { or: false, attr: 'permanent', eq: false }
            ],
            expectedErrorCodes: ['ConditionalCheckFailedException']
          });
          if (releaseResult === 'ConditionalCheckFailedException') {
            const err = new Error('Failed to release unique constraint.');
            err.code = 'FailedToReleaseUniqueConstraint';
            throw err;
          }
          return releaseResult;
        },
        persist: async () => {
          const persistResult = await model.modify({
            id,
            permanent: true,
            reserveDurationMs: 0,
            ucReserveTimeUnixMs: Number.MAX_SAFE_INTEGER
          }, {
            conditions: [
              { attr: 'guid', eq: reserveResult?.item?.guid },
              { or: false, attr: 'permanent', eq: false }
            ],
            expectedErrorCodes: ['ConditionalCheckFailedException']
          });
          if (persistResult === 'ConditionalCheckFailedException') {
            const err = new Error('Failed to persist unique constraint.');
            err.code = 'FailedToPersistUniqueConstraint';
            throw err;
          }
          return persistResult;
        }
      };
    }
  };
};
