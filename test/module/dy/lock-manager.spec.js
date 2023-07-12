import { expect } from 'chai';
import { describe } from 'node-tdd';
import { buildLockManager, LocalTable } from '../../dy-helper.js';
import nockReqHeaderOverwrite from '../../req-header-overwrite.js';

describe('Testing lock-manager.js', {
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
  let lockManager;
  let localTable;

  beforeEach(async () => {
    const LockManager = buildLockManager();
    lockManager = LockManager('lock-table-name', { leaseDurationMs: 100 });
    // eslint-disable-next-line no-underscore-dangle
    localTable = LocalTable(lockManager._model);
    await localTable.create();
  });
  afterEach(async () => {
    await localTable.delete();
  });

  it('Testing basic locking', async () => {
    const lock = await lockManager.lock('lock-name');
    expect(typeof lock.release).to.deep.equal('function');
    expect(lock.result).to.deep.equal({
      created: true,
      modified: true,
      item: {
        guid: 'ed420363-bfd7-4e3b-9f3a-5b25c8793a34',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
    const r = await lock.release();
    expect(r).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
  });

  it('Testing already locked', async ({ capture }) => {
    const lock1 = await lockManager.lock('lock-name');
    const err = await capture(() => lockManager.lock('lock-name'));
    expect(String(err)).to.deep.equal('FailedToAcquireLock: Failed to acquire lock.');
    const r1 = await lock1.release();
    expect(r1).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
    const lock2 = await lockManager.lock('lock-name');
    const r2 = await lock2.release();
    expect(r2).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
  });

  it('Testing already locked, but expired', async ({ capture }) => {
    const lock1 = await lockManager.lock('lock-name');
    // eslint-disable-next-line no-underscore-dangle
    await lockManager._model.modify({
      id: 'lock-name',
      lockAcquiredTimeUnixMs: (new Date() / 1) - 1000
    });
    const lock2 = await lockManager.lock('lock-name');
    expect(lock2.result).to.deep.equal({
      created: false,
      modified: true,
      item: {
        guid: 'ed420363-bfd7-4e3b-9f3a-5b25c8793a34',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
    const r2 = await lock2.release();
    expect(r2).to.deep.equal({
      deleted: true,
      item: {
        guid: 'd85df83d-c38e-45d5-a369-2460889ce6c6',
        id: 'lock-name',
        leaseDurationMs: 100,
        lockAcquiredTimeUnixMs: 1650651221000,
        owner: 'aws-sdk-wrap-lock-manager'
      }
    });
    const err = await capture(() => lock1.release());
    expect(String(err)).to.deep.equal('FailedToReleaseLock: Failed to release lock.');
  });

  it('Testing only one lock can succeed', async () => {
    const genPromise = () => lockManager.lock('lock-name').then(() => 'ok').catch(() => 'err');
    const r = await Promise.all(Array.from({ length: 100 }).map(genPromise));
    expect(r.filter((e) => e === 'ok').length).to.deep.equal(1);
  });
});
