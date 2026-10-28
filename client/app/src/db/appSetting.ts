/**
 * 앱이 실행 사이에 기억해야 하는 작은 설정값 저장소(key-value).
 *
 * Session처럼 전용 표를 만들지 않은 이유: 여기 들어오는 값은 스칼라 하나짜리라 컬럼을 가질
 * 구조가 없고, 하나 늘 때마다 표와 마이그레이션이 늘면 스키마가 값의 개수만큼 커진다.
 *
 * 값을 항상 문자열로 다루는 것은 sqlite 타입 친화성 때문이다 — 불리언이든 숫자든 읽을 때
 * 파싱 규칙을 **부르는 쪽이** 정하게 두면, 저장값이 깨졌을 때 무엇을 기본값으로 삼을지도
 * 그쪽이 정할 수 있다(db/session.ts의 parseUser와 같은 태도).
 */
import { getFirstSqlAsync, runSqlAsync } from './sqlite';

export async function readAppSetting(key: string): Promise<string | null> {
  const row = await getFirstSqlAsync<{ value: string }>('SELECT value FROM AppSetting WHERE key = ?;', [key]);
  return row?.value ?? null;
}

export async function writeAppSetting(key: string, value: string): Promise<void> {
  await runSqlAsync(
    `INSERT INTO AppSetting (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updatedAt = excluded.updatedAt;`,
    [key, value, Date.now()],
  );
}
