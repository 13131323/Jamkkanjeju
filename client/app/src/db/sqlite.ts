import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('tamnalog.db');
let initializationPromise: Promise<void> | null = null;

/** 현재 스키마 버전. 표를 바꿀 때마다 올리고 아래 마이그레이션에 단계를 추가한다 */
const SCHEMA_VERSION = 3;

/**
 * 표를 만들고 필요한 마이그레이션을 적용한다.
 *
 * CREATE TABLE IF NOT EXISTS는 이미 있는 표에 컬럼을 더해주지 않는다. 그래서 새로 만든 DB는
 * 아래 CREATE로 최신 스키마가 되고, 이미 있던 DB는 user_version을 보고 ALTER로 따라잡는다.
 */
async function migrateDatabase(): Promise<void> {
  await db.execAsync(
    `PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS DailySteps (
      date TEXT PRIMARY KEY,
      steps INTEGER NOT NULL,
      lastSensorValue INTEGER NOT NULL,
      synced INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      accessToken TEXT NOT NULL,
      tokenType TEXT NOT NULL,
      userJson TEXT,
      apiOrigin TEXT,
      updatedAt INTEGER NOT NULL
    );`,
  );

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  // 방금 만들어진 DB는 0이고, 위 CREATE로 이미 최신 스키마다.
  const version = versionRow?.user_version ?? 0;

  // v2의 Session에는 apiOrigin이 없다. 토큰을 발급한 서버를 기억하지 못하면
  // API 주소를 바꿨을 때 죽은 토큰을 계속 재사용한다(services/auth.ts 참고).
  if (version === 2) {
    await db.execAsync('ALTER TABLE Session ADD COLUMN apiOrigin TEXT;').catch((error: unknown) => {
      // 마이그레이션이 중간에 끊겼다 다시 돌면 컬럼이 이미 있을 수 있다
      if (!String(error).includes('duplicate column')) throw error;
    });
  }

  if (version !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}

async function ensureDatabaseInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = migrateDatabase().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

export async function runSqlAsync(sql: string, params: SQLite.SQLiteBindParams = []): Promise<SQLite.SQLiteRunResult> {
  await ensureDatabaseInitialized();
  return db.runAsync(sql, params);
}

export async function getFirstSqlAsync<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T | null> {
  await ensureDatabaseInitialized();
  return db.getFirstAsync<T>(sql, params);
}

export async function getAllSqlAsync<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T[]> {
  await ensureDatabaseInitialized();
  return db.getAllAsync<T>(sql, params);
}

export type SqlTransaction = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export async function withExclusiveSqlTransactionAsync(task: (transaction: SqlTransaction) => Promise<void>): Promise<void> {
  await ensureDatabaseInitialized();
  await db.withExclusiveTransactionAsync((transaction) => task(transaction));
}
