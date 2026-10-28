import { getAllSqlAsync, runSqlAsync } from '@/db/sqlite';
import { getTodayKST } from './stepCounterService';

export type StepRecord = {
  date: string;
  steps: number;
};

export type StepRecordSender = (record: StepRecord) => Promise<void>;

/** 미전송 레코드(어제 이전)를 백엔드에 전송한다 */
export async function syncUnsentRecords(
  sender?: StepRecordSender,
): Promise<void> {
  if (!sender) return;

  const today = getTodayKST();
  const unsent = await getAllSqlAsync<StepRecord>(
    'SELECT date, steps FROM DailySteps WHERE synced = 0 AND date < ? ORDER BY date ASC;',
    [today],
  );

  if (unsent.length === 0) return;

  for (const record of unsent) {
    try {
      await sender(record);

      await runSqlAsync(
        'UPDATE DailySteps SET synced = 1, updatedAt = ? WHERE date = ?;',
        [Date.now(), record.date],
      );
    } catch (error) {
      console.warn(`[StepSync] 전송 실패 (${record.date}):`, error);
      // synced=false 유지 → 다음 실행 시 재시도
      break;
    }
  }
}
