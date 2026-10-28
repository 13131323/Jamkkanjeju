import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqliteMocks = vi.hoisted(() => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  getAllAsync: vi.fn(),
  withExclusiveTransactionAsync: vi.fn(),
  openDatabaseSync: vi.fn(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: sqliteMocks.openDatabaseSync,
}));

describe('sqlite access layer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sqliteMocks.openDatabaseSync.mockReturnValue(sqliteMocks);
    sqliteMocks.execAsync.mockResolvedValue(undefined);
    sqliteMocks.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    sqliteMocks.getFirstAsync.mockResolvedValue({ value: 1 });
    sqliteMocks.getAllAsync.mockResolvedValue([{ value: 1 }]);
  });

  it('shares one initialization across simultaneous reads and returns completed rows', async () => {
    const { getAllSqlAsync, getFirstSqlAsync } = await import('./sqlite');

    const [first, all] = await Promise.all([getFirstSqlAsync<{ value: number }>('SELECT 1;'), getAllSqlAsync<{ value: number }>('SELECT 1;')]);

    // 마이그레이션 한 번 = 표 생성 + user_version 기록. 동시 호출이라도 두 번 돌면 안 된다.
    expect(sqliteMocks.execAsync).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ value: 1 });
    expect(all).toEqual([{ value: 1 }]);
    expect(sqliteMocks.getFirstAsync).toHaveBeenCalledWith('SELECT 1;', []);
    expect(sqliteMocks.getAllAsync).toHaveBeenCalledWith('SELECT 1;', []);
  });

  it('retries initialization after an initialization failure', async () => {
    sqliteMocks.execAsync.mockRejectedValueOnce(new Error('initialization failed'));
    const { runSqlAsync } = await import('./sqlite');

    await expect(runSqlAsync('UPDATE DailySteps SET steps = 1;')).rejects.toThrow('initialization failed');
    await expect(runSqlAsync('UPDATE DailySteps SET steps = 1;')).resolves.toEqual({
      changes: 1,
      lastInsertRowId: 1,
    });

    // 실패한 시도 1번 + 다시 돈 마이그레이션 2번
    expect(sqliteMocks.execAsync).toHaveBeenCalledTimes(3);
  });

  it('새로 만든 DB의 Session에는 apiOrigin이 처음부터 들어 있다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 0 });
    const { runSqlAsync } = await import('./sqlite');

    await runSqlAsync('SELECT 1;');

    const createSql = String(sqliteMocks.execAsync.mock.calls[0][0]);
    expect(createSql).toContain('apiOrigin');
    // 방금 만든 표라 따라잡을 것이 없다
    const alterCalls = sqliteMocks.execAsync.mock.calls.filter((call) => String(call[0]).includes('ALTER TABLE'));
    expect(alterCalls).toHaveLength(0);
  });

  it('v2 DB는 ALTER로 apiOrigin 컬럼을 따라잡는다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 2 });
    const { runSqlAsync } = await import('./sqlite');

    await runSqlAsync('SELECT 1;');

    const statements = sqliteMocks.execAsync.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('ALTER TABLE Session ADD COLUMN apiOrigin'))).toBe(true);
    expect(statements.some((sql) => sql.includes('user_version = 3'))).toBe(true);
  });

  // v1 = 실제로 출시된 v1.0.0 앱의 상태다. Session 표가 아예 없으므로 위쪽 CREATE가
  // apiOrigin까지 갖춘 표를 새로 만든다 — 여기에 ALTER를 또 걸면 duplicate column이 나고,
  // 오류 문구가 조금만 달라지면 마이그레이션 전체가 실패해 토큰이 캐시에 오르지 못한다.
  it('v1 DB(=v1.0.0, Session 표 없음)에는 ALTER를 걸지 않는다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 1 });
    const { runSqlAsync } = await import('./sqlite');

    await runSqlAsync('SELECT 1;');

    const statements = sqliteMocks.execAsync.mock.calls.map((call) => String(call[0]));
    // CREATE가 이미 최신 스키마를 만들었다 — 따라잡을 것이 없다
    expect(statements[0]).toContain('apiOrigin');
    expect(statements.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
    expect(statements.some((sql) => sql.includes('user_version = 3'))).toBe(true);
  });

  it('v1 DB에서 ALTER를 걸지 않으므로 duplicate column 문구에 의존하지 않는다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 1 });
    // 실패 문구가 무엇이든(expo-sqlite 업그레이드로 바뀌어도) 이 경로는 영향받지 않아야 한다
    sqliteMocks.execAsync.mockImplementation((sql: string) => (String(sql).includes('ALTER TABLE') ? Promise.reject(new Error('무슨 문구든')) : Promise.resolve(undefined)));
    const { runSqlAsync } = await import('./sqlite');

    await expect(runSqlAsync('SELECT 1;')).resolves.toBeDefined();
  });

  it('이미 최신 버전이면 마이그레이션을 다시 쓰지 않는다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 3 });
    const { runSqlAsync } = await import('./sqlite');

    await runSqlAsync('SELECT 1;');

    const statements = sqliteMocks.execAsync.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('ALTER TABLE'))).toBe(false);
    expect(statements.some((sql) => sql.includes('user_version ='))).toBe(false);
  });

  it('컬럼이 이미 있다는 오류는 삼키고 계속 진행한다', async () => {
    sqliteMocks.getFirstAsync.mockResolvedValue({ user_version: 2 });
    sqliteMocks.execAsync.mockImplementation((sql: string) => (String(sql).includes('ALTER TABLE') ? Promise.reject(new Error('duplicate column name: apiOrigin')) : Promise.resolve(undefined)));
    const { runSqlAsync } = await import('./sqlite');

    await expect(runSqlAsync('SELECT 1;')).resolves.toBeDefined();
  });
});
