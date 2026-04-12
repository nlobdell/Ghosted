import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { utcIso } from '@/lib/server/core';
import { getDatabase, resetDatabaseForTests } from '@/lib/server/database';

type EnvKey =
  | 'ADMIN_DISCORD_IDS'
  | 'COMPANION_ASSET_DIR'
  | 'DAILY_WAGER_CAP'
  | 'DATABASE_PATH'
  | 'DISCORD_BOT_TOKEN'
  | 'DISCORD_GUILD_ID'
  | 'DEV_AUTH_ADMIN'
  | 'ENABLE_DEV_AUTH'
  | 'SESSION_COOKIE_SECURE'
  | 'WOM_API_BASE'
  | 'WOM_CACHE_TTL_SECONDS'
  | 'WOM_GROUP_ID';

const ENV_KEYS: EnvKey[] = [
  'ADMIN_DISCORD_IDS',
  'COMPANION_ASSET_DIR',
  'DAILY_WAGER_CAP',
  'DATABASE_PATH',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'DEV_AUTH_ADMIN',
  'ENABLE_DEV_AUTH',
  'SESSION_COOKIE_SECURE',
  'WOM_API_BASE',
  'WOM_CACHE_TTL_SECONDS',
  'WOM_GROUP_ID',
];

export type ServerTestContext = {
  db: Database;
  tempDir: string;
  previousEnv: Record<EnvKey, string | undefined>;
};

export function setupServerTestEnvironment(overrides: Partial<Record<EnvKey, string | undefined>> = {}): ServerTestContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghosted-vitest-'));
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<EnvKey, string | undefined>;

  process.env.DATABASE_PATH = overrides.DATABASE_PATH ?? path.join(tempDir, 'ghosted.db');
  process.env.COMPANION_ASSET_DIR = overrides.COMPANION_ASSET_DIR ?? path.join(tempDir, 'companion-assets');
  process.env.DAILY_WAGER_CAP = overrides.DAILY_WAGER_CAP ?? '';
  process.env.DEV_AUTH_ADMIN = overrides.DEV_AUTH_ADMIN ?? '';
  process.env.DISCORD_BOT_TOKEN = overrides.DISCORD_BOT_TOKEN ?? '';
  process.env.DISCORD_GUILD_ID = overrides.DISCORD_GUILD_ID ?? '';
  process.env.WOM_GROUP_ID = overrides.WOM_GROUP_ID ?? '123';
  process.env.WOM_CACHE_TTL_SECONDS = overrides.WOM_CACHE_TTL_SECONDS ?? '900';
  process.env.WOM_API_BASE = overrides.WOM_API_BASE ?? 'https://api.wiseoldman.net/v2';
  process.env.ENABLE_DEV_AUTH = overrides.ENABLE_DEV_AUTH ?? 'false';
  process.env.SESSION_COOKIE_SECURE = overrides.SESSION_COOKIE_SECURE ?? '';
  process.env.ADMIN_DISCORD_IDS = overrides.ADMIN_DISCORD_IDS ?? '';

  resetDatabaseForTests();
  const db = getDatabase();
  return { db, tempDir, previousEnv };
}

export function cleanupServerTestEnvironment(context: ServerTestContext) {
  resetDatabaseForTests();
  fs.rmSync(context.tempDir, { recursive: true, force: true });

  for (const key of ENV_KEYS) {
    const value = context.previousEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export function insertUser(
  db: Database,
  overrides: Partial<{
    discordId: string;
    username: string;
    globalName: string | null;
    avatarHash: string | null;
    rolesJson: string;
    isAdmin: number;
  }> = {},
) {
  const now = utcIso();
  const result = db.prepare(`
    INSERT INTO users (
      discord_id, username, global_name, avatar_hash, roles_json, is_admin, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.discordId ?? `discord-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    overrides.username ?? 'tester',
    overrides.globalName ?? 'Tester',
    overrides.avatarHash ?? null,
    overrides.rolesJson ?? '[]',
    overrides.isAdmin ?? 0,
    now,
    now,
  );

  return Number(result.lastInsertRowid);
}

export function addRewardLedgerEntry(
  db: Database,
  userId: number,
  amount: number,
  entryType = 'test_credit',
  description = 'Test reward credit',
  metadata: Record<string, unknown> = {},
) {
  db.prepare(`
    INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, amount, entryType, description, JSON.stringify(metadata), utcIso());
}
