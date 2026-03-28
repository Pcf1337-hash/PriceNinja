import * as SQLite from 'expo-sqlite';

export interface Migration {
  version: number;
  up: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY NOT NULL
      );
      INSERT OR IGNORE INTO schema_version (version) VALUES (0);
    `,
  },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);

  const result = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = result?.version ?? 0;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      await db.execAsync(migration.up);
      await db.runAsync(
        'INSERT OR REPLACE INTO schema_version (version) VALUES (?)',
        [migration.version]
      );
    }
  }
}
