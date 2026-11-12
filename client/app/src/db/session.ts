/** 액세스 토큰·사용자 정보·만료 시각의 SQLite 저장소. 리프레시 토큰은 SecureStore에서만 관리한다. */
import type { GeneratedApi, LoginSession } from '@packages/shared';
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

  let login: Partial<LoginSession> = {};
  let user = parseUser(row.userJson);
  try {
    const value = JSON.parse(row.userJson ?? 'null');
    if (value?.loginUser) {
      login = value;
      user = value.user ?? null;
    }
  } catch {
    /* 손상된 데이터는 로그인 복원에서 제외한다. */
  }
  return {
    ...(login.loginUser ? { loginUser: login.loginUser, expiresAt: login.expiresAt } : {}),
    accessToken: row.accessToken,
    tokenType: row.tokenType,
    user,
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
  const session = await readSession();
  const value = session?.loginUser ? { user, loginUser: { ...session.loginUser, onboardingCompleted: true }, expiresAt: session.expiresAt } : user;
  await runSqlAsync('UPDATE Session SET userJson = ?, updatedAt = ? WHERE id = 1;', [JSON.stringify(value), Date.now()]);
}

export async function clearSession(): Promise<void> {
  await runSqlAsync('DELETE FROM Session WHERE id = 1;');
}

/** 로그인 시 이전 계정의 온보딩 데이터를 함께 교체한다. */
export async function saveLoginSession(session: LoginSession, apiOrigin: string, user: GeneratedApi.UserResponse | null = null): Promise<void> {
  await runSqlAsync(
    `INSERT INTO Session (id, accessToken, tokenType, userJson, apiOrigin, updatedAt)
    VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET accessToken=excluded.accessToken,
    tokenType=excluded.tokenType, userJson=excluded.userJson, apiOrigin=excluded.apiOrigin, updatedAt=excluded.updatedAt;`,
    [session.accessToken, session.tokenType, JSON.stringify({ loginUser: session.loginUser, expiresAt: session.expiresAt, user }), apiOrigin, Date.now()],
  );
}
