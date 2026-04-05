import Database from 'better-sqlite3';
import path from 'node:path';

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data', 'ghosted.db');

let database: Database.Database | null = null;

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_accounts (
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_account_id)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id
    ON auth_accounts(user_id);
  `);
}

export function getAuthDb() {
  if (!database) {
    database = new Database(databasePath);
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
    ensureSchema(database);
  }

  return database;
}
