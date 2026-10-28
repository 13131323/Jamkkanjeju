import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getAllSqlAsync: vi.fn(),
  runSqlAsync: vi.fn(),
}));

vi.mock('../db/sqlite', () => dbMocks);
vi.mock('./stepCounterService', () => ({
  getTodayKST: () => '2026-08-08',
}));

describe('syncUnsentRecords', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMocks.getAllSqlAsync.mockResolvedValue([
      { date: '2026-08-07', steps: 123 },
      { date: '2026-08-06', steps: 99 },
    ]);
    dbMocks.runSqlAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 0 });
  });

  it('does not read or change sync state when no sender is configured', async () => {
    const { syncUnsentRecords } = await import('./stepSyncService');

    await syncUnsentRecords();

    expect(dbMocks.getAllSqlAsync).not.toHaveBeenCalled();
    expect(dbMocks.runSqlAsync).not.toHaveBeenCalled();
  });

  it('marks each row synced only after its sender succeeds', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const { syncUnsentRecords } = await import('./stepSyncService');

    await syncUnsentRecords(sender);

    expect(sender).toHaveBeenNthCalledWith(1, {
      date: '2026-08-07',
      steps: 123,
    });
    expect(sender).toHaveBeenNthCalledWith(2, {
      date: '2026-08-06',
      steps: 99,
    });
    expect(dbMocks.runSqlAsync).toHaveBeenCalledTimes(2);
    expect(dbMocks.runSqlAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('synced = 1'),
      [expect.any(Number), '2026-08-07'],
    );
  });

  it('leaves the failed row and later rows unsynced', async () => {
    const sender = vi.fn().mockRejectedValue(new Error('network failed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { syncUnsentRecords } = await import('./stepSyncService');

    await syncUnsentRecords(sender);

    expect(sender).toHaveBeenCalledTimes(1);
    expect(dbMocks.runSqlAsync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('2026-08-07'),
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
