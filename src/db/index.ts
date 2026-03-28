import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, DB_NAME } from './schema';
import { runMigrations } from './migrations';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await _db.execAsync(CREATE_TABLES_SQL);
  await runMigrations(_db);

  return _db;
}

export * from './queries';
export * from './schema';
