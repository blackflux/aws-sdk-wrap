import { expect } from 'chai';
import { describe } from 'node-tdd';
import { buildUcManager, LocalTable } from '../../dy-helper.js';
import nockReqHeaderOverwrite from '../../req-header-overwrite.js';

describe('Testing uc-manager.js', {
  timestamp: '2022-04-22T18:13:41.000Z',
  timeout: 5000,
  useNock: true,
  nockReqHeaderOverwrite,
  nockStripHeaders: true,
  record: console,
  cryptoSeed: 'f0df70e4-e3d5-45ca-bc6c-9b17f606dcc6',
  cryptoSeedReseed: true,
  envVarsFile: '../../default.env.yml'
}, () => {
  let ucManager;
  let localTable;

  beforeEach(async () => {
    const LockManager = buildUcManager();
    ucManager = LockManager('uc-table-name', { reserveDurationMs: 100 });
    // eslint-disable-next-line no-underscore-dangle
    localTable = LocalTable(ucManager._model);
    await localTable.create();
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing reserve and persist', async () => {
    const reservation = await ucManager.reserve({ id: '1234' });
    expect(typeof reservation.release).to.deep.equal('function');
    expect(reservation.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: false,
        reserveDurationMs: 100,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    });
    const r = await reservation.persist();
    expect(r).to.deep.equal({
      created: false,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: true,
        reserveDurationMs: 0,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 9007199254740991
      },
      modified: true
    });
  });

  it('Testing reserve and release', async () => {
    const reservation = await ucManager.reserve({ id: '1234' });
    expect(typeof reservation.release).to.deep.equal('function');
    expect(reservation.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: false,
        reserveDurationMs: 100,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    });
    const r = await reservation.release();
    expect(r).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: false,
        reserveDurationMs: 100,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    });
  });

  it('Testing persist and delete', async () => {
    const persisted = await ucManager.persist({ id: '1234' });
    expect(persisted).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: true,
        reserveDurationMs: 0,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 9007199254740991
      }
    });
    const deleted = await ucManager.delete({ id: '1234' });
    expect(deleted).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: true,
        reserveDurationMs: 0,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 9007199254740991
      }
    });
  });

  it('Testing persist, error and force', async ({ capture }) => {
    const r1 = await ucManager.persist({ id: '1234' });
    expect(r1).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: '1234'
      }
    });
    const r2 = await capture(() => ucManager.persist({ id: '1234' }));
    expect(r2.code).to.equal('FailedToPersistUniqueConstraint');
    const r3 = await ucManager.persist({ id: '1234', force: true });
    expect(r3).to.deep.equal({
      created: false,
      modified: false,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: '1234'
      }
    });
  });

  it('Testing delete, not found', async ({ capture }) => {
    const r1 = await capture(() => ucManager.delete({ id: '1234' }));
    expect(r1.code).to.equal('FailedToDeleteUniqueConstraint');
  });

  it('Testing double reserve', async ({ capture }) => {
    const reservation = await ucManager.reserve({ id: '1234' });
    expect(typeof reservation.release).to.deep.equal('function');
    expect(reservation.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: false,
        reserveDurationMs: 100,
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    });
    const r1 = await capture(() => ucManager.reserve({ id: '1234' }));
    expect(r1.code).to.equal('FailedToReserveUniqueConstraint');
  });

  it('Testing reserved persist and release failure', async ({ capture }) => {
    const reservation = await ucManager.reserve({ id: '1234' });
    expect(reservation.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        timestamp: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234'
      }
    });
    const persisted = await ucManager.persist({ id: '1234' });
    expect(persisted).to.deep.equal({
      created: false,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        timestamp: 1650651221000,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234'
      }
    });
    const err1 = await capture(() => reservation.persist());
    expect(err1.code).to.deep.equal('FailedToPersistUniqueConstraint');
    const err2 = await capture(() => reservation.release());
    expect(err2.code).to.deep.equal('FailedToReleaseUniqueConstraint');
  });

  it('Testing cleanup', async ({ capture }) => {
    const a = await ucManager.reserve({ id: 'A' });
    await ucManager.reserve({ id: 'B' });
    const c = await ucManager.reserve({ id: 'C' });
    await ucManager.reserve({ id: 'D' });
    await a.release();
    await c.persist();
    const result = await ucManager.cleanup();
    expect(result).to.deep.equal([{
      status: 'fulfilled',
      value: {
        deleted: true,
        item: {
          reserveDurationMs: 100,
          permanent: false,
          id: 'B',
          guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
          owner: 'aws-sdk-wrap-uc-manager',
          timestamp: 1650651221000,
          ucReserveTimeUnixMs: 1650651221000
        }
      }
    }, {
      status: 'fulfilled',
      value: {
        deleted: true,
        item: {
          reserveDurationMs: 100,
          permanent: false,
          id: 'D',
          guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
          owner: 'aws-sdk-wrap-uc-manager',
          timestamp: 1650651221000,
          ucReserveTimeUnixMs: 1650651221000
        }
      }
    }]);
  });

  it('Testing ignore delete error', async ({ capture }) => {
    const e = await capture(() => ucManager.delete({ id: 'A' }));
    const r = await ucManager.delete({ id: 'A', ignoreError: true });
    expect(e.code).to.deep.equal('FailedToDeleteUniqueConstraint');
    expect(r).to.deep.equal({
      error: 'not_found',
      key: { id: 'A' }
    });
  });

  it('Testing reserveAll and releaseAll', async ({ capture }) => {
    const r1 = await ucManager.reserveAll({ ids: ['a', 'b'] });
    const r2 = await r1.releaseAll();
    expect(r1.results).to.deep.equal([{
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'a'
      }
    }, {
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'b'
      }
    }]);
    expect(r2).to.deep.equal([{
      deleted: true,
      item: {
        reserveDurationMs: 100,
        permanent: false,
        id: 'a',
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        owner: 'aws-sdk-wrap-uc-manager',
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    }, {
      deleted: true,
      item: {
        reserveDurationMs: 100,
        permanent: false,
        id: 'b',
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        owner: 'aws-sdk-wrap-uc-manager',
        timestamp: 1650651221000,
        ucReserveTimeUnixMs: 1650651221000
      }
    }]);
  });

  it('Testing reserveAll and persistAll', async ({ capture }) => {
    const r1 = await ucManager.reserveAll({ ids: ['a', 'b'] });
    const r2 = await r1.persistAll();
    expect(r1.results).to.deep.equal([{
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'a'
      }
    }, {
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'b'
      }
    }]);
    expect(r2).to.deep.equal([{
      created: false,
      modified: true,
      item: {
        reserveDurationMs: 0,
        permanent: true,
        id: 'a',
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        ucReserveTimeUnixMs: 9007199254740991,
        timestamp: 1650651221000,
        owner: 'aws-sdk-wrap-uc-manager'
      }
    }, {
      created: false,
      modified: true,
      item: {
        reserveDurationMs: 0,
        permanent: true,
        id: 'b',
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        ucReserveTimeUnixMs: 9007199254740991,
        timestamp: 1650651221000,
        owner: 'aws-sdk-wrap-uc-manager'
      }
    }]);
  });

  it('Testing reserveAll with error', async ({ capture }) => {
    await ucManager.reserve({ id: 'a' });
    const e = await capture(() => ucManager.reserveAll({ ids: ['a', 'b'] }));
    expect(e.code).to.deep.equal('FailedToReserveUniqueConstraint');
  });

  it('Testing persistAll', async ({ capture }) => {
    const r = await ucManager.persistAll({ ids: ['a', 'b'], force: true });
    expect(r).to.deep.equal([{
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'a'
      }
    }, {
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: 'b'
      }
    }]);
  });

  it('Testing deleteAll', async ({ capture }) => {
    const r = await ucManager.deleteAll({ ids: ['a', 'b'], ignoreErrors: true });
    expect(r).to.deep.equal([{
      error: 'not_found',
      key: { id: 'a' }
    }, {
      error: 'not_found',
      key: { id: 'b' }
    }]);
  });

  it('Testing reserve with unixInMs', async () => {
    const r = await ucManager.reserve({
      id: '1234',
      unixInMs: new Date() / 1
    });
    expect(r.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: '1234'
      }
    });
  });

  it('Testing persist with unixInMs', async () => {
    const r = await ucManager.persist({
      id: '1234',
      unixInMs: new Date() / 1
    });
    expect(r).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        timestamp: 1650651221000,
        id: '1234'
      }
    });
  });

  it('Testing delete with unixInMs', async ({ capture }) => {
    const r = await capture(() => ucManager.delete({
      id: '1234',
      unixInMs: new Date() / 1
    }));
    expect(r.code).to.deep.equal('FailedToDeleteUniqueConstraint');
  });

  it('Testing cleanup with unixInMs', async () => {
    const a = await ucManager.reserve({ id: 'A' });
    await ucManager.reserve({ id: 'B' });
    const c = await ucManager.reserve({ id: 'C' });
    await ucManager.reserve({ id: 'D' });
    await a.release();
    await c.persist();

    const r = await ucManager.cleanup({
      unixInMs: new Date() / 1
    });
    expect(r).to.deep.equal([
      { status: 'rejected', reason: 'Error: Failed to cleanup unique constraint.' },
      { status: 'rejected', reason: 'Error: Failed to cleanup unique constraint.' }
    ]);
  });
});
