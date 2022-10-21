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
    const reservation = await ucManager.reserve('1234');
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
        ucReserveTimeUnixMs: 9007199254740991
      },
      modified: true
    });
  });

  it('Testing reserve and release', async () => {
    const reservation = await ucManager.reserve('1234');
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
        ucReserveTimeUnixMs: 1650651221000
      }
    });
  });

  it('Testing persist and delete', async () => {
    const persisted = await ucManager.persist('1234');
    expect(persisted).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: true,
        reserveDurationMs: 0,
        ucReserveTimeUnixMs: 9007199254740991
      }
    });
    const deleted = await ucManager.delete('1234');
    expect(deleted).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234',
        owner: 'aws-sdk-wrap-uc-manager',
        permanent: true,
        reserveDurationMs: 0,
        ucReserveTimeUnixMs: 9007199254740991
      }
    });
  });

  it('Testing persist, error and force', async ({ capture }) => {
    const r1 = await ucManager.persist('1234');
    expect(r1).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234'
      }
    });
    const r2 = await capture(() => ucManager.persist('1234'));
    expect(r2.code).to.equal('FailedToPersistUniqueConstraint');
    const r3 = await ucManager.persist('1234', true);
    expect(r3).to.deep.equal({
      created: false,
      modified: false,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
        reserveDurationMs: 0,
        permanent: true,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234'
      }
    });
  });

  it('Testing delete, not found', async ({ capture }) => {
    const r1 = await capture(() => ucManager.delete('1234'));
    expect(r1.code).to.equal('FailedToDeleteUniqueConstraint');
  });

  it('Testing double reserve', async ({ capture }) => {
    const reservation = await ucManager.reserve('1234');
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
        ucReserveTimeUnixMs: 1650651221000
      }
    });
    const r1 = await capture(() => ucManager.reserve('1234'));
    expect(r1.code).to.equal('FailedToReserveUniqueConstraint');
  });

  it('Testing reserved persist and release failure', async ({ capture }) => {
    const reservation = await ucManager.reserve('1234');
    expect(reservation.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 1650651221000,
        permanent: false,
        reserveDurationMs: 100,
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: '1234'
      }
    });
    const persisted = await ucManager.persist('1234');
    expect(persisted).to.deep.equal({
      created: false,
      modified: true,
      item: {
        owner: 'aws-sdk-wrap-uc-manager',
        ucReserveTimeUnixMs: 9007199254740991,
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
    const a = await ucManager.reserve('A');
    await ucManager.reserve('B');
    const c = await ucManager.reserve('C');
    await ucManager.reserve('D');
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
          ucReserveTimeUnixMs: 1650651221000
        }
      }
    }]);
  });

  it('Testing ignore delete error', async ({ capture }) => {
    const e = await capture(() => ucManager.delete('A'));
    const r = await ucManager.delete('A', true);
    expect(e.code).to.deep.equal('FailedToDeleteUniqueConstraint');
    expect(r).to.deep.equal({
      error: 'not_found',
      key: { id: 'A' }
    });
  });
});
