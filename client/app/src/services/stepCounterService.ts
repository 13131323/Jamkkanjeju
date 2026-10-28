import {
  startStepCounterUpdate,
  stopStepCounterUpdate,
} from 'react-native-step-counter-newarch';
import {
  getFirstSqlAsync,
  withExclusiveSqlTransactionAsync,
} from '@/db/sqlite';

let recordQueue: Promise<void> = Promise.resolve();

function enqueueRecord<T>(operation: () => Promise<T>): Promise<T> {
  const result = recordQueue.then(operation);
  recordQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** KST(UTC+9) 기준 오늘 날짜를 YYYY-MM-DD로 반환 */
export function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** SQLite에 걸음 수를 기록한다 */
export async function recordSteps(sensorValue: number): Promise<number> {
  return enqueueRecord(async () => {
    const today = getTodayKST();
    const now = Date.now();
    let currentSteps = 0;

    await withExclusiveSqlTransactionAsync(async (transaction) => {
      const existing = await transaction.getFirstAsync<{
        steps: number;
        lastSensorValue: number;
      }>('SELECT steps, lastSensorValue FROM DailySteps WHERE date = ?;', [today]);

      if (existing) {
        const delta =
          sensorValue >= existing.lastSensorValue
            ? sensorValue - existing.lastSensorValue
            : sensorValue;
        currentSteps = existing.steps + delta;

        await transaction.runAsync(
          'UPDATE DailySteps SET steps = ?, lastSensorValue = ?, synced = 0, updatedAt = ? WHERE date = ?;',
          [currentSteps, sensorValue, now, today],
        );
        return;
      }

      await transaction.runAsync(
        'INSERT INTO DailySteps (date, steps, lastSensorValue, synced, updatedAt) VALUES (?, ?, ?, 0, ?);',
        [today, 0, sensorValue, now],
      );
    });

    return currentSteps;
  });
}

/** 오늘의 걸음 수 반환 */
export async function getTodaySteps(): Promise<number> {
  const today = getTodayKST();
  const row = await getFirstSqlAsync<{ steps: number }>(
    'SELECT steps FROM DailySteps WHERE date = ?;',
    [today],
  );
  return row?.steps ?? 0;
}

export type StepCallback = (steps: number) => void;

/** 센서 업데이트 시작. 콜백으로 현재 누적 걸음 수 전달 */
export function startCounting(callback: StepCallback): void {
  startStepCounterUpdate(new Date(), (data) => {
    void recordSteps(data.steps)
      .then(callback)
      .catch((error) => {
        console.warn('[StepCounterService] recordSteps failed:', error);
      });
  });
}

/** 센서 업데이트 중지 */
export function stopCounting(): void {
  stopStepCounterUpdate();
}
