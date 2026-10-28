import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMocks = vi.hoisted(() => ({
  runSqlAsync: vi.fn(),
  getFirstSqlAsync: vi.fn(),
}));

vi.mock('./sqlite', () => ({
  runSqlAsync: sqlMocks.runSqlAsync,
  getFirstSqlAsync: sqlMocks.getFirstSqlAsync,
}));

const USER = {
  id: 8,
  arCharacter: { id: 5, name: '협재 파도지기', imageUrl: 'https://example.com/a.png' },
  userTravelStyle: null,
};

describe('session 저장소', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlMocks.runSqlAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  });

  it('저장된 행이 없으면 null을 준다', async () => {
    sqlMocks.getFirstSqlAsync.mockResolvedValue(null);
    const { readSession } = await import('./session');

    await expect(readSession()).resolves.toBeNull();
  });

  it('userJson이 없으면 user를 null로 돌려준다', async () => {
    sqlMocks.getFirstSqlAsync.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      userJson: null,
      apiOrigin: 'http://localhost:8000',
    });
    const { readSession } = await import('./session');

    await expect(readSession()).resolves.toEqual({
      accessToken: 'token',
      tokenType: 'Bearer',
      user: null,
      apiOrigin: 'http://localhost:8000',
    });
  });

  it('apiOrigin 컬럼이 생기기 전에 저장된 행은 null로 읽는다', async () => {
    sqlMocks.getFirstSqlAsync.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      userJson: null,
      apiOrigin: null,
    });
    const { readSession } = await import('./session');

    await expect(readSession()).resolves.toMatchObject({ apiOrigin: null });
  });

  it('토큰을 저장할 때 발급한 서버 주소를 함께 남긴다', async () => {
    const { saveToken } = await import('./session');

    await saveToken('token', 'Bearer', 'http://localhost:8000');

    const [sql, params] = sqlMocks.runSqlAsync.mock.calls[0];
    expect(sql).toContain('apiOrigin');
    expect(params).toContain('http://localhost:8000');
  });

  it('userJson을 역직렬화해 돌려준다', async () => {
    sqlMocks.getFirstSqlAsync.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      userJson: JSON.stringify(USER),
    });
    const { readSession } = await import('./session');

    const session = await readSession();

    expect(session?.user).toEqual(USER);
  });

  it('깨진 userJson은 앱을 죽이지 않고 user를 null로 만든다', async () => {
    sqlMocks.getFirstSqlAsync.mockResolvedValue({
      accessToken: 'token',
      tokenType: 'Bearer',
      userJson: '{not json',
    });
    const { readSession } = await import('./session');

    const session = await readSession();

    expect(session?.user).toBeNull();
    expect(session?.accessToken).toBe('token');
  });

  it('토큰을 다시 저장해도 온보딩 결과(userJson)를 덮지 않는다', async () => {
    const { saveToken } = await import('./session');

    await saveToken('token', 'Bearer', 'http://localhost:8000');

    const [sql] = sqlMocks.runSqlAsync.mock.calls[0];
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(sql).not.toContain('userJson = excluded');
  });

  it('saveUser는 id=1 행만 갱신한다', async () => {
    const { saveUser } = await import('./session');

    await saveUser(USER);

    const [sql, params] = sqlMocks.runSqlAsync.mock.calls[0];
    expect(sql).toContain('WHERE id = 1');
    expect(params[0]).toBe(JSON.stringify(USER));
  });

  it('clearSession은 행을 지운다', async () => {
    const { clearSession } = await import('./session');

    await clearSession();

    const [sql] = sqlMocks.runSqlAsync.mock.calls[0];
    expect(sql).toContain('DELETE FROM Session');
  });
});
