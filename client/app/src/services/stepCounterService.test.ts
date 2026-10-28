import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  withExclusiveSqlTransactionAsync: vi.fn(),
}));

const sensorMocks = vi.hoisted(() => ({
  startStepCounterUpdate: vi.fn(),
  stopStepCounterUpdate: vi.fn(),
}));

vi.mock('../db/sqlite', () => dbMocks);
vi.mock('react-native-step-counter-newarch', () => sensorMocks);

type StoredRow = { steps: number; lastSensorValue: number };

function createTransaction(existing: StoredRow | null) {
  return {
    getFirstAsync: vi.fn().mockResolvedValue(existing),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
  };
}

describe('recordSteps', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T03:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the first sensor value as a baseline with zero steps', async () => {
    const transaction = createTransaction(null);
    dbMocks.withExclusiveSqlTransactionAsync.mockImplementation((task) =>
      task(transaction),
    );
    const { recordSteps } = await import('./stepCounterService');

    await expect(recordSteps(100)).resolves.toBe(0);
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO DailySteps'),
      ['2026-08-08', 0, 100, expect.any(Number)],
    );
  });

  it('adds the sensor delta to the stored steps', async () => {
    const transaction = createTransaction({ steps: 40, lastSensorValue: 100 });
    dbMocks.withExclusiveSqlTransactionAsync.mockImplementation((task) =>
      task(transaction),
    );
    const { recordSteps } = await import('./stepCounterService');

    await expect(recordSteps(115)).resolves.toBe(55);
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE DailySteps'),
      [55, 115, expect.any(Number), '2026-08-08'],
    );
  });

  it('uses a reset sensor value as the next delta', async () => {
    const transaction = createTransaction({ steps: 40, lastSensorValue: 100 });
    dbMocks.withExclusiveSqlTransactionAsync.mockImplementation((task) =>
      task(transaction),
    );
    const { recordSteps } = await import('./stepCounterService');

    await expect(recordSteps(5)).resolves.toBe(45);
  });

  it('serializes overlapping sensor events in arrival order', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstTransaction = createTransaction(null);
    const secondTransaction = createTransaction({ steps: 0, lastSensorValue: 100 });
    dbMocks.withExclusiveSqlTransactionAsync
      .mockImplementationOnce(async (task) => {
        await firstGate;
        await task(firstTransaction);
      })
      .mockImplementationOnce((task) => task(secondTransaction));
    const { recordSteps } = await import('./stepCounterService');

    const first = recordSteps(100);
    const second = recordSteps(110);
    await vi.waitFor(() => {
      expect(dbMocks.withExclusiveSqlTransactionAsync).toHaveBeenCalledTimes(1);
    });

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([0, 10]);
    expect(dbMocks.withExclusiveSqlTransactionAsync).toHaveBeenCalledTimes(2);
  });

  it('continues processing after an earlier write fails', async () => {
    const transaction = createTransaction(null);
    dbMocks.withExclusiveSqlTransactionAsync
      .mockRejectedValueOnce(new Error('write failed'))
      .mockImplementationOnce((task) => task(transaction));
    const { recordSteps } = await import('./stepCounterService');

    await expect(recordSteps(100)).rejects.toThrow('write failed');
    await expect(recordSteps(110)).resolves.toBe(0);
  });
});
