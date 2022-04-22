import { expect } from 'chai';
import { describe } from 'node-tdd';
import { buildLockManager } from '../../dy-helper.js';

describe('Testing lock-manager.js', {
  timestamp: '2022-04-22T18:13:41.000Z',
  timeout: 55000,
  useNock: true,
  record: console,
  cryptoSeed: 'f0df70e4-e3d5-45ca-bc6c-9b17f606dcc6'
}, () => {
  let LockManager;

  before(() => {
    LockManager = buildLockManager();
  });

  it('Testing Basic Setup', async () => {
    const locker = LockManager('lock-table-name');
    const lock = await locker.lock('lock-name');
    await lock.release('lock-name');
  });

  it('Testing Nested Locks', async () => {
    const locker = LockManager('lock-table-name');
    const lockOuter = await locker.lock('lock-name-outer');
    const lockInner = await locker.lock('lock-name-inner');
    await lockInner.release();
    await lockOuter.release();
  });

  // TODO: figure me out...
  it('Testing Lock Timeout', async () => {
    const locker = LockManager('lock-table-name');
    const lock = await locker.lock('lock-name-timeout');
    await lock.release();
  });

  it('Testing Lock Failure', async ({ capture }) => {
    const locker = LockManager('lock-table-name');
    const err = await capture(() => locker.lock('lock-failure'));
    expect(String(err)).to.equal('UnknownError: null');
  });

  it('Testing Lock Release Failure', async ({ capture }) => {
    const locker = LockManager('lock-table-name');
    const lock = await locker.lock('lock-release-failure');
    const err = await capture(() => lock.release());
    expect(String(err)).to.equal('UnknownError: null');
  });

  it('Testing Heartbeat Failure', async ({ recorder }) => {
    const lockerHeartbeat = LockManager('lock-table-name', {
      leaseDurationMs: 1000,
      heartbeatPeriodMs: 600
    });
    await lockerHeartbeat.lock('lock-name-heartbeat-failure');
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    expect(recorder.get()).to.deep
      .equal(['Error: Failed to renew heartbeat for lock lock-name-heartbeat-failure\nUnknownError: null']);
  });
});
