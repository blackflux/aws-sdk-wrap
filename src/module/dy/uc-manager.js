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
  const temporary = [];
  const reserve = async (id) => {
    const nowInMs = new Date() / 1;
    const guid = crypto.randomUUID();
    const reserveResult = await wrap('Reserve', (m) => m.createOrReplace({
      id,
      guid,
      reserveDurationMs,
      permanent: false,
      ucReserveTimeUnixMs: nowInMs,
      owner
    }, {
      conditions: [
        { attr: 'id', exists: false },
        [
          { or: true, attr: 'ucReserveTimeUnixMs', lt: nowInMs - reserveDurationMs },
          { attr: 'permanent', eq: false }
        ]
      ],
      expectedErrorCodes: ['ConditionalCheckFailedException']
    }));
    temporary.push([id, guid]);
    return {
      result: reserveResult,
      release: async () => {
        temporary.splice(temporary.findIndex((e) => e[0] === id && e[1] === guid), 1);
        return wrap('Release', (m) => m.delete({ id }, {
          conditions: [
            { attr: 'guid', eq: reserveResult?.item?.guid },
            { attr: 'permanent', eq: false }
          ],
          expectedErrorCodes: ['ConditionalCheckFailedException']
        }));
      },
      persist: async () => {
        temporary.splice(temporary.findIndex((e) => e[0] === id && e[1] === guid), 1);
        return wrap('Persist', (m) => m.modify({
          id,
          permanent: true,
          reserveDurationMs: 0,
          ucReserveTimeUnixMs: Number.MAX_SAFE_INTEGER
        }, {
          conditions: [
            { attr: 'guid', eq: reserveResult?.item?.guid },
            { attr: 'permanent', eq: false }
          ],
          expectedErrorCodes: ['ConditionalCheckFailedException']
        }));
      }
    };
  };
  const persist = async (id, force = false) => wrap('Persist', (m) => m.createOrReplace(
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
  ));
  const del = async (id, ignoreError = false) => wrap('Delete', (m) => m.delete(
    { id },
    ignoreError === true ? {
      onNotFound: (key) => ({
        error: 'not_found',
        key
      })
    } : {
      conditions: { attr: 'id', exists: true },
      expectedErrorCodes: ['ConditionalCheckFailedException']
    }
  ));

  return {
    get _model() {
      return getModelCached();
    },
    reserve,
    persist,
    delete: del,
    reserveAll: async (ids) => {
      const reservations = await Promise.allSettled(ids.map((id) => reserve(id)));
      if (reservations.every((r) => r?.status === 'fulfilled')) {
        return {
          results: reservations.map(({ value }) => value.result),
          releaseAll: async () => Promise.all(reservations.map(({ value }) => value.release())),
          persistAll: async () => Promise.all(reservations.map(({ value }) => value.persist()))
        };
      }
      await Promise.allSettled(
        reservations
          .filter((r) => r?.status === 'fulfilled')
          .map(({ value }) => value.release())
      );
      throw reservations.find((r) => r?.status !== 'fulfilled')?.reason;
    },
    persistAll: (ids, force = false) => Promise.all(ids.map((id) => persist(id, force))),
    deleteAll: (ids, ignoreErrors = false) => Promise.all(ids.map((id) => del(id, ignoreErrors))),
    cleanup: async () => Promise.allSettled(
      temporary.splice(0).map(
        ([id, guid]) => wrap('Cleanup', (m) => m.delete({ id }, {
          conditions: [
            { attr: 'guid', eq: guid },
            { attr: 'permanent', eq: false }
          ],
          expectedErrorCodes: ['ConditionalCheckFailedException']
        }))
      )
    )
  };
};
