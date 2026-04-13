import 'server-only';

import Database from 'better-sqlite3';
import path from 'node:path';
import { seedDefaultCasinoGames } from '@/lib/server/casino';
import { ensureDefaultCompanionBase, removeLegacyDefaultCompanionAssets } from '@/lib/server/companion-schema';

let database: Database.Database | null = null;
let schemaReady = false;

function resolveDatabasePath() {
  return process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'data', 'ghosted.db');
}

function tableColumns(db: Database.Database, tableName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => String(row.name)));
}

function ensureTableColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  if (tableColumns(db, tableName).has(columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      global_name TEXT,
      avatar_hash TEXT,
      roles_json TEXT NOT NULL DEFAULT '[]',
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_states (
      state TEXT PRIMARY KEY,
      next_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS reward_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      entry_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS casino_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      cost INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS casino_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id INTEGER NOT NULL REFERENCES casino_games(id),
      wager INTEGER NOT NULL,
      payout INTEGER NOT NULL,
      symbols_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS casino_bonus_state (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id INTEGER NOT NULL REFERENCES casino_games(id) ON DELETE CASCADE,
      free_spins_remaining INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      point_cost INTEGER NOT NULL DEFAULT 0,
      max_entries INTEGER NOT NULL DEFAULT 1,
      required_role_id TEXT,
      status TEXT NOT NULL,
      winner_user_id INTEGER REFERENCES users(id),
      created_by_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      created_by_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_game_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      wom_player_id INTEGER NOT NULL UNIQUE,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 1,
      linked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, game)
    );

    CREATE TABLE IF NOT EXISTS wom_cache (
      cache_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companion_catalog (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      rarity TEXT NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      front_asset_path TEXT,
      back_asset_path TEXT,
      render_metadata_json TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      archived_at TEXT,
      archived_by_user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_companion_inventory (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_slug TEXT NOT NULL REFERENCES companion_catalog(slug) ON DELETE CASCADE,
      unlocked_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_slug)
    );

    CREATE TABLE IF NOT EXISTS user_companion_loadout (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      hat_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
      face_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
      neck_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
      body_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companion_settings (
      singleton_key TEXT PRIMARY KEY,
      base_asset_path TEXT NOT NULL,
      base_head_asset_path TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discord_voice_presence (
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, discord_id)
    );

    CREATE INDEX IF NOT EXISTS idx_discord_voice_presence_channel
    ON discord_voice_presence(guild_id, channel_id);

    CREATE INDEX IF NOT EXISTS idx_discord_voice_presence_seen
    ON discord_voice_presence(guild_id, last_seen_at);

    CREATE TABLE IF NOT EXISTS scene_presence_channel_allowlist (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS discord_presence_worker_state (
      guild_id TEXT PRIMARY KEY,
      runtime_status TEXT NOT NULL,
      bot_install_status TEXT NOT NULL,
      last_heartbeat_at TEXT,
      last_sync_at TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scene_shared_snapshots (
      scene_key TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      variant TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      saved_at INTEGER NOT NULL,
      payload_source TEXT NOT NULL,
      live_count INTEGER NOT NULL,
      entities_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scene_world_variants (
      world_id TEXT PRIMARY KEY,
      draft_package_json TEXT,
      published_package_json TEXT,
      draft_tuning_json TEXT,
      published_tuning_json TEXT,
      draft_updated_at TEXT,
      published_at TEXT,
      draft_updated_by_user_id INTEGER REFERENCES users(id),
      published_by_user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scene_world_archived_layers (
      world_id TEXT NOT NULL,
      layer_key TEXT NOT NULL,
      asset_path TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      archived_by_user_id INTEGER REFERENCES users(id),
      PRIMARY KEY (world_id, layer_key)
    );
  `);

  ensureTableColumn(db, 'companion_catalog', 'front_asset_path', 'TEXT');
  ensureTableColumn(db, 'companion_catalog', 'back_asset_path', 'TEXT');
  ensureTableColumn(db, 'companion_catalog', 'render_metadata_json', 'TEXT');
  ensureTableColumn(db, 'companion_catalog', 'updated_at', 'TEXT');
  ensureTableColumn(db, 'companion_catalog', 'archived_at', 'TEXT');
  ensureTableColumn(db, 'companion_catalog', 'archived_by_user_id', 'INTEGER REFERENCES users(id)');
  ensureTableColumn(db, 'companion_settings', 'base_head_asset_path', 'TEXT');
  ensureTableColumn(db, 'scene_world_variants', 'draft_tuning_json', 'TEXT');
  ensureTableColumn(db, 'scene_world_variants', 'published_tuning_json', 'TEXT');
  db.exec(`
    UPDATE companion_catalog
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL
  `);
  seedDefaultCasinoGames(db);
  ensureDefaultCompanionBase(db);
  removeLegacyDefaultCompanionAssets(db);
}

export function getDatabase() {
  if (!database) {
    const databasePath = resolveDatabasePath();
    database = new Database(databasePath);
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
  }

  if (!schemaReady) {
    ensureSchema(database);
    schemaReady = true;
  }

  return database;
}

export function resetDatabaseForTests() {
  if (database) {
    database.close();
  }
  database = null;
  schemaReady = false;
}
