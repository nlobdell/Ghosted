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
      public_name_source TEXT NOT NULL DEFAULT 'discord',
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
      claim_source TEXT NOT NULL DEFAULT 'manual_wom',
      claimed_at TEXT,
      verified_at TEXT,
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

    CREATE TABLE IF NOT EXISTS osrs_claim_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_username TEXT NOT NULL,
      wom_player_id INTEGER,
      code_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      redeemed_at TEXT,
      redeemed_username TEXT
    );

    CREATE TABLE IF NOT EXISTS runelite_pairings (
      id TEXT PRIMARY KEY,
      user_code TEXT NOT NULL UNIQUE,
      poll_token_hash TEXT NOT NULL UNIQUE,
      requested_account_hash TEXT NOT NULL,
      requested_username TEXT NOT NULL,
      launcher_display_name TEXT,
      plugin_version TEXT,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by_user_id INTEGER REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_runelite_pairings_status
    ON runelite_pairings(status, expires_at);

    CREATE TABLE IF NOT EXISTS runelite_account_links (
      account_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      current_username TEXT NOT NULL,
      launcher_display_name TEXT,
      plugin_version TEXT,
      linked_at TEXT NOT NULL,
      last_verified_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runelite_account_links_user
    ON runelite_account_links(user_id);

    CREATE TABLE IF NOT EXISTS twitch_loot_chest_settings (
      singleton_key TEXT PRIMARY KEY,
      broadcaster_user_id TEXT,
      broadcaster_login TEXT,
      broadcaster_display_name TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      token_scope_json TEXT NOT NULL DEFAULT '[]',
      reward_id TEXT,
      reward_title TEXT NOT NULL DEFAULT 'Loot Chest Spin',
      reward_prompt TEXT NOT NULL DEFAULT 'Redeem for a host-run Ghosted loot chest turn.',
      reward_cost INTEGER NOT NULL DEFAULT 1000,
      reward_is_paused INTEGER NOT NULL DEFAULT 0,
      reward_is_enabled INTEGER NOT NULL DEFAULT 0,
      overlay_token TEXT NOT NULL,
      oauth_state TEXT,
      oauth_state_actor_discord_id TEXT,
      oauth_state_expires_at TEXT,
      eventsub_subscription_id TEXT,
      eventsub_status TEXT,
      eventsub_callback_url TEXT,
      eventsub_last_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS twitch_loot_chest_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      redemption_id TEXT NOT NULL UNIQUE,
      reward_id TEXT NOT NULL,
      viewer_twitch_id TEXT NOT NULL,
      viewer_login TEXT NOT NULL,
      viewer_display_name TEXT NOT NULL,
      user_input TEXT,
      status TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pending',
      prize_chest_index INTEGER,
      selected_chests_json TEXT NOT NULL DEFAULT '[]',
      revealed_chests_json TEXT NOT NULL DEFAULT '[]',
      fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED',
      redeemed_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_twitch_loot_chest_turns_status
    ON twitch_loot_chest_turns(status, redeemed_at);

    CREATE TABLE IF NOT EXISTS twitch_loot_chest_events (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS twitch_platform_settings (
      singleton_key TEXT PRIMARY KEY,
      oauth_state TEXT,
      oauth_state_actor_discord_id TEXT,
      oauth_state_expires_at TEXT,
      oauth_state_next_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS twitch_platform_broadcasters (
      broadcaster_user_id TEXT PRIMARY KEY,
      broadcaster_login TEXT NOT NULL,
      broadcaster_display_name TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      token_scope_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_twitch_platform_broadcasters_active
    ON twitch_platform_broadcasters(is_active, updated_at DESC);

    CREATE TABLE IF NOT EXISTS twitch_platform_subscriptions (
      id TEXT PRIMARY KEY,
      module_key TEXT NOT NULL,
      subscription_type TEXT NOT NULL,
      subscription_version TEXT NOT NULL,
      broadcaster_user_id TEXT,
      condition_json TEXT NOT NULL DEFAULT '{}',
      transport_method TEXT,
      callback_url TEXT,
      status TEXT NOT NULL,
      last_verified_at TEXT,
      last_sync_attempt_at TEXT,
      revoked_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_twitch_platform_subscriptions_lookup
    ON twitch_platform_subscriptions(subscription_type, module_key, broadcaster_user_id);

    CREATE TABLE IF NOT EXISTS twitch_platform_deliveries (
      message_id TEXT PRIMARY KEY,
      subscription_id TEXT,
      subscription_type TEXT,
      message_type TEXT NOT NULL,
      broadcaster_user_id TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      processing_status TEXT NOT NULL DEFAULT 'received',
      processing_attempts INTEGER NOT NULL DEFAULT 0,
      raw_headers_json TEXT NOT NULL DEFAULT '{}',
      raw_body TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      received_at TEXT NOT NULL,
      processed_at TEXT,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_twitch_platform_deliveries_status
    ON twitch_platform_deliveries(processing_status, received_at DESC);
  `);

  ensureTableColumn(db, 'users', 'public_name_source', "TEXT NOT NULL DEFAULT 'discord'");
  ensureTableColumn(db, 'user_game_accounts', 'claim_source', "TEXT NOT NULL DEFAULT 'manual_wom'");
  ensureTableColumn(db, 'user_game_accounts', 'claimed_at', 'TEXT');
  ensureTableColumn(db, 'user_game_accounts', 'verified_at', 'TEXT');
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
    UPDATE users
    SET public_name_source = 'discord'
    WHERE public_name_source IS NULL OR TRIM(public_name_source) = ''
  `);
  db.exec(`
    UPDATE user_game_accounts
    SET claim_source = 'manual_wom'
    WHERE claim_source IS NULL OR TRIM(claim_source) = ''
  `);
  db.exec(`
    UPDATE user_game_accounts
    SET claimed_at = linked_at
    WHERE claimed_at IS NULL
  `);
  db.exec(`
    UPDATE companion_catalog
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL
  `);

  const legacyLootChestSettings = db.prepare(`
    SELECT *
    FROM twitch_loot_chest_settings
    WHERE singleton_key = 'default'
    LIMIT 1
  `).get() as {
    broadcaster_user_id: string | null;
    broadcaster_login: string | null;
    broadcaster_display_name: string | null;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
    token_scope_json: string | null;
    oauth_state: string | null;
    oauth_state_actor_discord_id: string | null;
    oauth_state_expires_at: string | null;
    eventsub_subscription_id: string | null;
    eventsub_status: string | null;
    eventsub_callback_url: string | null;
    eventsub_last_verified_at: string | null;
    reward_id: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (legacyLootChestSettings) {
    db.prepare(`
      INSERT OR IGNORE INTO twitch_platform_settings (
        singleton_key,
        oauth_state,
        oauth_state_actor_discord_id,
        oauth_state_expires_at,
        oauth_state_next_path,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      legacyLootChestSettings.oauth_state,
      legacyLootChestSettings.oauth_state_actor_discord_id,
      legacyLootChestSettings.oauth_state_expires_at,
      '/v/giveaways/',
      legacyLootChestSettings.created_at,
      legacyLootChestSettings.updated_at,
    );

    if (legacyLootChestSettings.broadcaster_user_id) {
      db.prepare(`
        INSERT OR IGNORE INTO twitch_platform_broadcasters (
          broadcaster_user_id,
          broadcaster_login,
          broadcaster_display_name,
          access_token,
          refresh_token,
          token_expires_at,
          token_scope_json,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        legacyLootChestSettings.broadcaster_user_id,
        legacyLootChestSettings.broadcaster_login ?? legacyLootChestSettings.broadcaster_user_id,
        legacyLootChestSettings.broadcaster_display_name
          ?? legacyLootChestSettings.broadcaster_login
          ?? legacyLootChestSettings.broadcaster_user_id,
        legacyLootChestSettings.access_token,
        legacyLootChestSettings.refresh_token,
        legacyLootChestSettings.token_expires_at,
        legacyLootChestSettings.token_scope_json ?? '[]',
        legacyLootChestSettings.created_at,
        legacyLootChestSettings.updated_at,
      );
    }

    if (legacyLootChestSettings.eventsub_subscription_id) {
      db.prepare(`
        INSERT OR IGNORE INTO twitch_platform_subscriptions (
          id,
          module_key,
          subscription_type,
          subscription_version,
          broadcaster_user_id,
          condition_json,
          transport_method,
          callback_url,
          status,
          last_verified_at,
          last_sync_attempt_at,
          revoked_reason,
          created_at,
          updated_at
        )
        VALUES (?, 'giveaways', 'channel.channel_points_custom_reward_redemption.add', '1', ?, ?, 'webhook', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        legacyLootChestSettings.eventsub_subscription_id,
        legacyLootChestSettings.broadcaster_user_id,
        JSON.stringify({
          broadcaster_user_id: legacyLootChestSettings.broadcaster_user_id,
          reward_id: legacyLootChestSettings.reward_id,
        }),
        legacyLootChestSettings.eventsub_callback_url,
        legacyLootChestSettings.eventsub_status ?? 'enabled',
        legacyLootChestSettings.eventsub_last_verified_at,
        legacyLootChestSettings.updated_at,
        legacyLootChestSettings.eventsub_status?.includes('revoked')
          ? legacyLootChestSettings.eventsub_status
          : null,
        legacyLootChestSettings.created_at,
        legacyLootChestSettings.updated_at,
      );
    }
  }

  const legacyLootChestEvents = db.prepare(`
    SELECT *
    FROM twitch_loot_chest_events
  `).all() as Array<{
    id: string;
    event_type: string;
    payload_json: string;
    created_at: string;
  }>;

  for (const event of legacyLootChestEvents) {
    db.prepare(`
      INSERT OR IGNORE INTO twitch_platform_deliveries (
        message_id,
        subscription_type,
        message_type,
        broadcaster_user_id,
        verified,
        processing_status,
        processing_attempts,
        raw_headers_json,
        raw_body,
        payload_json,
        received_at,
        processed_at
      )
      VALUES (?, 'channel.channel_points_custom_reward_redemption.add', ?, ?, 1, ?, 1, '{}', ?, ?, ?, ?)
    `).run(
      event.id,
      event.event_type,
      legacyLootChestSettings?.broadcaster_user_id ?? null,
      event.event_type === 'notification' || event.event_type === 'revocation' || event.event_type === 'webhook_callback_verification'
        ? 'processed'
        : 'ignored',
      event.payload_json,
      event.payload_json,
      event.created_at,
      event.created_at,
    );
  }

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
