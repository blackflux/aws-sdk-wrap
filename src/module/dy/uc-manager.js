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
  const wrap = async (name, fn) => {
    const model = getModelCached();
    const result = await fn(model);
    if (result === 'ConditionalCheckFailedException') {
      const err = new Error(`Failed to ${name.toLowerCase()} unique constraint.`);
      err.code = `FailedTo${name}UniqueConstraint`;
      throw err;
    }
    return result;
  };
  return {
    get _model() {
      return getModelCached();
    },
    persist: async (id, force = false) => wrap('Persist', (m) => m.createOrReplace(
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
    )),
    delete: async (id) => wrap('Delete', (m) => m.delete({ id }, {
      conditions: { attr: 'id', exists: true },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    })),
    reserve: async (id) => {
      const nowInMs = new Date() / 1;
      const reserveResult = await wrap('Reserve', (m) => m.createOrReplace({
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
      }));
      return {
        result: reserveResult,
        release: async () => wrap('Release', (m) => m.delete({ id }, {
          conditions: [
            { attr: 'guid', eq: reserveResult?.item?.guid },
            { or: false, attr: 'permanent', eq: false }
          ],
          expectedErrorCodes: ['ConditionalCheckFailedException']
        })),
        persist: async () => wrap('Persist', (m) => m.modify({
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
        }))
      };
    }
  };
};
