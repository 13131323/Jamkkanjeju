/**
 * 익명 세션(토큰 + 온보딩 응답) 로컬 저장소.
 *
 * userJson이 온보딩 게이트의 판정 기준이다. PATCH /users/me 응답을 실제로
 * 받았을 때만 채워지므로, 호출은 했는데 응답이 없으면 다음 실행에서
 * 온보딩이 다시 뜬다 — 별도 플래그가 필요 없다.
 */
import type { GeneratedApi } from '@packages/shared';
import type { SessionRow, StoredSession } from './models/Session';
import { getFirstSqlAsync, runSqlAsync } from './sqlite';

type SessionReadRow = Pick<SessionRow, 'accessToken' | 'tokenType' | 'userJson' | 'apiOrigin'>;

function parseUser(userJson: string | null): GeneratedApi.UserResponse | null {
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as GeneratedApi.UserResponse;
  } catch {
    // 저장값이 깨졌다면 온보딩을 다시 시키는 편이 낫다. 토큰까지 버릴 이유는 없다.
    return null;
  }
}

export async function readSession(): Promise<StoredSession | null> {
  const row = await getFirstSqlAsync<SessionReadRow>('SELECT accessToken, tokenType, userJson, apiOrigin FROM Session WHERE id = 1;');
  if (!row) return null;

  return {
    accessToken: row.accessToken,
    tokenType: row.tokenType,
    user: parseUser(row.userJson),
    apiOrigin: row.apiOrigin ?? null,
  };
}

/**
 * @param apiOrigin 이 토큰을 발급한 API 주소. 서버가 바뀌었는지 판정하는 근거다.
 */
export async function saveToken(accessToken: string, tokenType: string, apiOrigin: string): Promise<void> {
  // SET 절에 userJson이 없어야 재발급이 온보딩 결과를 지우지 않는다.
  await runSqlAsync(
    `INSERT INTO Session (id, accessToken, tokenType, userJson, apiOrigin, updatedAt)
     VALUES (1, ?, ?, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       accessToken = excluded.accessToken,
       tokenType = excluded.tokenType,
       apiOrigin = excluded.apiOrigin,
       updatedAt = excluded.updatedAt;`,
    [accessToken, tokenType, apiOrigin, Date.now()],
  );
}

export async function saveUser(user: GeneratedApi.UserResponse): Promise<void> {
  await runSqlAsync('UPDATE Session SET userJson = ?, updatedAt = ? WHERE id = 1;', [JSON.stringify(user), Date.now()]);
}

export async function clearSession(): Promise<void> {
  await runSqlAsync('DELETE FROM Session WHERE id = 1;');
}
