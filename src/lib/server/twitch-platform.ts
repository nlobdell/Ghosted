import 'server-only';

import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type {
  TwitchBroadcasterConnection,
  TwitchEventDelivery,
  TwitchEventDeliveryStatus,
  TwitchEventSubSubscription,
  TwitchModuleHealth,
  TwitchPlatformState,
} from '@/lib/types';
import { AppError, envText, jsonLoad, parseIso, utcIso } from '@/lib/server/core';
import { getDatabase } from '@/lib/server/database';
import { displayName, getCurrentUser } from '@/lib/server/ghosted-api';

const PLATFORM_SETTINGS_KEY = 'default';
const OAUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;
const EVENTSUB_MESSAGE_NOTIFICATION = 'notification';
const EVENTSUB_MESSAGE_VERIFICATION = 'webhook_callback_verification';
const EVENTSUB_MESSAGE_REVOCATION = 'revocation';
export const TWITCH_PLATFORM_USER_SCOPES = ['channel:manage:redemptions', 'channel:read:redemptions'] as const;

type TwitchOperatorUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type TwitchPlatformSettingsRow = {
  singleton_key: string;
  oauth_state: string | null;
  oauth_state_actor_discord_id: string | null;
  oauth_state_expires_at: string | null;
  oauth_state_next_path: string | null;
  created_at: string;
  updated_at: string;
};

export type TwitchPlatformBroadcasterRow = {
  broadcaster_user_id: string;
  broadcaster_login: string;
  broadcaster_display_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  token_scope_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type TwitchPlatformSubscriptionRow = {
  id: string;
  module_key: string;
  subscription_type: string;
  subscription_version: string;
  broadcaster_user_id: string | null;
  condition_json: string;
  transport_method: string | null;
  callback_url: string | null;
  status: string;
  last_verified_at: string | null;
  last_sync_attempt_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TwitchPlatformDeliveryRow = {
  message_id: string;
  subscription_id: string | null;
  subscription_type: string | null;
  message_type: string;
  broadcaster_user_id: string | null;
  verified: number;
  processing_status: TwitchEventDeliveryStatus;
  processing_attempts: number;
  raw_headers_json: string;
  raw_body: string;
  payload_json: string;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
};

export type TwitchEventEnvelope = {
  challenge?: string;
  subscription?: {
    id?: string;
    status?: string;
    type?: string;
    version?: string;
    condition?: {
      broadcaster_user_id?: string;
      [key: string]: unknown;
    };
    transport?: {
      method?: string;
      callback?: string;
    };
  };
  event?: Record<string, unknown>;
};

type TwitchTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
  message?: string;
};

type TwitchUserIdentity = {
  id: string;
  login: string;
  display_name: string;
};

type TwitchPlatformConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  eventSubSecret?: string;
  baseUrl?: string;
  callbackUrl?: string;
  oauthReady: boolean;
  eventSubReady: boolean;
  operatorAllowlistConfigured: boolean;
};

export interface TwitchPlatformGateway {
  exchangeCode(code: string): Promise<TwitchTokenResponse>;
  refreshUserToken(refreshToken: string): Promise<TwitchTokenResponse>;
  getAppAccessToken(): Promise<string>;
  getUserIdentity(accessToken: string): Promise<TwitchUserIdentity>;
  ensureFreshBroadcaster(db: Database): Promise<TwitchPlatformBroadcasterRow>;
  userApiRequest<T>(
    db: Database,
    input: {
      path: string;
      method?: 'GET' | 'POST' | 'PATCH';
      query?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
    },
  ): Promise<T>;
  eventSubApiRequest<T>(
    input: {
      path: string;
      method?: 'GET' | 'POST' | 'DELETE';
      query?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
    },
  ): Promise<T>;
}

export interface TwitchPlatformStore {
  getSettings(db?: Database): TwitchPlatformSettingsRow;
  saveOauthState(db: Database, input: {
    state: string;
    actorDiscordId: string;
    nextPath: string;
    expiresAt: string;
  }): TwitchPlatformSettingsRow;
  clearOauthState(db: Database): TwitchPlatformSettingsRow;
  getActiveBroadcaster(db?: Database): TwitchPlatformBroadcasterRow | undefined;
  upsertBroadcaster(db: Database, input: {
    broadcasterUserId: string;
    broadcasterLogin: string;
    broadcasterDisplayName: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: string | null;
    scopes?: string[];
    isActive?: boolean;
  }): TwitchPlatformBroadcasterRow;
  clearBroadcasterConnection(db: Database, broadcasterUserId: string): void;
  listSubscriptions(db?: Database): TwitchPlatformSubscriptionRow[];
  getSubscription(db: Database, id: string): TwitchPlatformSubscriptionRow | undefined;
  upsertSubscription(db: Database, input: {
    id: string;
    moduleKey: string;
    subscriptionType: string;
    subscriptionVersion: string;
    broadcasterUserId?: string | null;
    condition?: Record<string, unknown>;
    transportMethod?: string | null;
    callbackUrl?: string | null;
    status: string;
    lastVerifiedAt?: string | null;
    lastSyncAttemptAt?: string | null;
    revokedReason?: string | null;
  }): TwitchPlatformSubscriptionRow;
  deleteSubscription(db: Database, id: string): void;
  recordDelivery(db: Database, input: {
    messageId: string;
    subscriptionId?: string | null;
    subscriptionType?: string | null;
    messageType: string;
    broadcasterUserId?: string | null;
    verified: boolean;
    rawHeaders: Record<string, string>;
    rawBody: string;
    payloadJson: string;
  }): { inserted: boolean; row: TwitchPlatformDeliveryRow };
  getDelivery(db: Database, messageId: string): TwitchPlatformDeliveryRow | undefined;
  markDeliveryStatus(
    db: Database,
    messageId: string,
    status: Exclude<TwitchEventDeliveryStatus, 'received'>,
    lastError?: string | null,
  ): TwitchPlatformDeliveryRow;
  listRecentDeliveries(db?: Database, limit?: number): TwitchPlatformDeliveryRow[];
}

export interface TwitchModuleContext {
  db: Database;
  config: TwitchPlatformConfig;
  connection: TwitchPlatformBroadcasterRow;
  gateway: TwitchPlatformGateway;
  store: TwitchPlatformStore;
}

export interface TwitchModuleDeliveryContext extends TwitchModuleContext {
  delivery: TwitchPlatformDeliveryRow;
  envelope: TwitchEventEnvelope;
}

export interface TwitchModuleHandler {
  moduleKey: string;
  label: string;
  href: string;
  subscriptionTypes: string[];
  buildHealth(db: Database): Promise<TwitchModuleHealth> | TwitchModuleHealth;
  syncSubscriptions(context: TwitchModuleContext): Promise<void>;
  disconnect?(context: TwitchModuleContext): Promise<void>;
  processDelivery(context: TwitchModuleDeliveryContext): Promise<'processed' | 'ignored'>;
}

export interface TwitchEventProcessor {
  processPersistedDelivery(messageId: string, handlers: TwitchModuleHandler[]): Promise<Response>;
  handleWebhookRequest(request: Request, handlers: TwitchModuleHandler[]): Promise<Response>;
}

function getDb() {
  return getDatabase();
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

function normalizedNextPath(nextPath?: string | null) {
  const value = String(nextPath ?? '/v/twitch/').trim();
  if (!value.startsWith('/')) return '/v/twitch/';
  return value;
}

function twitchPlatformOperatorDiscordIds() {
  const ids = new Set<string>();
  for (const envName of ['TWITCH_OPERATOR_DISCORD_IDS', 'TWITCH_GAME_OPERATOR_DISCORD_IDS']) {
    for (const value of String(process.env[envName] ?? '').split(',')) {
      const normalized = value.trim();
      if (normalized) ids.add(normalized);
    }
  }
  return ids;
}

export function isTwitchPlatformOperator(user: Pick<TwitchOperatorUser, 'discord_id'> | null | undefined) {
  if (!user) return false;
  const operatorIds = twitchPlatformOperatorDiscordIds();
  return operatorIds.size > 0 && operatorIds.has(String(user.discord_id ?? '').trim());
}

export function twitchPlatformLoginHref(nextPath = '/v/twitch/') {
  const encodedNext = encodeURIComponent(normalizedNextPath(nextPath));
  return process.env.ENABLE_DEV_AUTH === 'true'
    ? `/auth/dev-login?next=${encodedNext}`
    : `/auth/login?next=${encodedNext}`;
}

export async function requireTwitchPlatformOperator() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError('Please sign in with Discord first.', 401);
  }
  if (!isTwitchPlatformOperator(user)) {
    throw new AppError('You do not have access to the Twitch operator console.', 403);
  }
  return user;
}

export function getTwitchPlatformConfig(): TwitchPlatformConfig {
  const clientId = envText('TWITCH_CLIENT_ID');
  const clientSecret = envText('TWITCH_CLIENT_SECRET');
  const redirectUri = envText('TWITCH_REDIRECT_URI');
  const eventSubSecret = envText('TWITCH_EVENTSUB_SECRET');
  const baseUrl = (envText('AUTH_URL') ?? envText('PUBLIC_BASE_URL'))?.replace(/\/+$/, '');
  const callbackUrl = baseUrl ? `${baseUrl}/api/v/twitch/eventsub` : undefined;
  return {
    clientId,
    clientSecret,
    redirectUri,
    eventSubSecret,
    baseUrl,
    callbackUrl,
    oauthReady: Boolean(clientId && clientSecret && redirectUri),
    eventSubReady: Boolean(clientId && clientSecret && eventSubSecret && callbackUrl),
    operatorAllowlistConfigured: twitchPlatformOperatorDiscordIds().size > 0,
  };
}

export function getTwitchPlatformFeatureBaseUrl() {
  return getTwitchPlatformConfig().baseUrl;
}

function assertTwitchOauthReady() {
  const config = getTwitchPlatformConfig();
  if (!config.oauthReady) {
    throw new AppError('Twitch OAuth is not configured yet.', 503);
  }
  return config;
}

function assertTwitchEventSubReady() {
  const config = getTwitchPlatformConfig();
  if (!config.eventSubReady || !config.callbackUrl) {
    throw new AppError('Twitch EventSub is not configured yet.', 503);
  }
  return config;
}

function ensurePlatformSettingsRow(db: Database) {
  const now = utcIso();
  db.prepare(`
    INSERT OR IGNORE INTO twitch_platform_settings (
      singleton_key,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?)
  `).run(PLATFORM_SETTINGS_KEY, now, now);
}

function migrateLegacyTwitchPlatformState(db: Database) {
  const legacySettings = db.prepare(`
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

  if (!legacySettings) return;

  const platformSettings = db.prepare(`
    SELECT *
    FROM twitch_platform_settings
    WHERE singleton_key = ?
    LIMIT 1
  `).get(PLATFORM_SETTINGS_KEY) as TwitchPlatformSettingsRow;

  if (!platformSettings.oauth_state && legacySettings.oauth_state) {
    db.prepare(`
      UPDATE twitch_platform_settings
      SET oauth_state = ?,
          oauth_state_actor_discord_id = ?,
          oauth_state_expires_at = ?,
          oauth_state_next_path = COALESCE(oauth_state_next_path, '/v/giveaways/'),
          updated_at = ?
      WHERE singleton_key = ?
    `).run(
      legacySettings.oauth_state,
      legacySettings.oauth_state_actor_discord_id,
      legacySettings.oauth_state_expires_at,
      utcIso(),
      PLATFORM_SETTINGS_KEY,
    );
  }

  const activeBroadcaster = db.prepare(`
    SELECT *
    FROM twitch_platform_broadcasters
    WHERE is_active = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `).get() as TwitchPlatformBroadcasterRow | undefined;

  if (!activeBroadcaster && legacySettings.broadcaster_user_id) {
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
      legacySettings.broadcaster_user_id,
      legacySettings.broadcaster_login ?? legacySettings.broadcaster_user_id,
      legacySettings.broadcaster_display_name
        ?? legacySettings.broadcaster_login
        ?? legacySettings.broadcaster_user_id,
      legacySettings.access_token,
      legacySettings.refresh_token,
      legacySettings.token_expires_at,
      legacySettings.token_scope_json ?? '[]',
      legacySettings.created_at,
      legacySettings.updated_at,
    );
  }

  if (legacySettings.eventsub_subscription_id) {
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
      legacySettings.eventsub_subscription_id,
      legacySettings.broadcaster_user_id,
      JSON.stringify({
        broadcaster_user_id: legacySettings.broadcaster_user_id,
        reward_id: legacySettings.reward_id,
      }),
      legacySettings.eventsub_callback_url,
      legacySettings.eventsub_status ?? 'enabled',
      legacySettings.eventsub_last_verified_at,
      legacySettings.updated_at,
      legacySettings.eventsub_status?.includes('revoked')
        ? legacySettings.eventsub_status
        : null,
      legacySettings.created_at,
      legacySettings.updated_at,
    );
  }
}

function ensurePlatformReady(db: Database) {
  ensurePlatformSettingsRow(db);
  migrateLegacyTwitchPlatformState(db);
}

function parseJsonResponse<T>(response: Response) {
  return response.text().then((raw) => {
    if (!raw) return null as T | null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new AppError(raw, 502);
    }
  });
}

function twitchApiError(message: string, details: unknown, status = 502): never {
  if (details && typeof details === 'object' && 'message' in details) {
    throw new AppError(`${message}: ${String((details as { message?: unknown }).message ?? '')}`.trim(), status);
  }
  throw new AppError(message, status);
}

function tokenExpiresSoon(expiresAt: string | null | undefined) {
  const parsed = parseIso(expiresAt);
  if (!parsed) return true;
  return parsed.getTime() - Date.now() <= 60_000;
}

function formUrlEncoded(body: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    params.set(key, value);
  }
  return params.toString();
}

function mapBroadcasterConnection(row: TwitchPlatformBroadcasterRow): TwitchBroadcasterConnection {
  return {
    id: row.broadcaster_user_id,
    login: row.broadcaster_login,
    displayName: row.broadcaster_display_name,
    connected: Boolean(row.access_token),
    isActive: Boolean(row.is_active),
    requiresReconnect: !row.access_token,
    scopes: jsonLoad<string[]>(row.token_scope_json, []),
    tokenExpiresAt: row.token_expires_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscription(row: TwitchPlatformSubscriptionRow): TwitchEventSubSubscription {
  return {
    id: row.id,
    moduleKey: row.module_key,
    subscriptionType: row.subscription_type,
    version: row.subscription_version,
    status: row.status,
    broadcasterUserId: row.broadcaster_user_id,
    callbackUrl: row.callback_url,
    condition: jsonLoad<Record<string, unknown>>(row.condition_json, {}),
    lastVerifiedAt: row.last_verified_at,
    lastSyncAttemptAt: row.last_sync_attempt_at,
    revokedReason: row.revoked_reason,
    updatedAt: row.updated_at,
  };
}

function mapDelivery(row: TwitchPlatformDeliveryRow): TwitchEventDelivery {
  return {
    messageId: row.message_id,
    subscriptionId: row.subscription_id,
    subscriptionType: row.subscription_type,
    messageType: row.message_type,
    broadcasterUserId: row.broadcaster_user_id,
    verified: Boolean(row.verified),
    processingStatus: row.processing_status,
    processingAttempts: row.processing_attempts,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    lastError: row.last_error,
  };
}

export const twitchPlatformStore: TwitchPlatformStore = {
  getSettings(db = getDb()) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_settings
      WHERE singleton_key = ?
      LIMIT 1
    `).get(PLATFORM_SETTINGS_KEY) as TwitchPlatformSettingsRow;
  },

  saveOauthState(db, input) {
    ensurePlatformReady(db);
    db.prepare(`
      UPDATE twitch_platform_settings
      SET oauth_state = ?,
          oauth_state_actor_discord_id = ?,
          oauth_state_expires_at = ?,
          oauth_state_next_path = ?,
          updated_at = ?
      WHERE singleton_key = ?
    `).run(
      input.state,
      input.actorDiscordId,
      input.expiresAt,
      normalizedNextPath(input.nextPath),
      utcIso(),
      PLATFORM_SETTINGS_KEY,
    );
    return this.getSettings(db);
  },

  clearOauthState(db) {
    ensurePlatformReady(db);
    db.prepare(`
      UPDATE twitch_platform_settings
      SET oauth_state = NULL,
          oauth_state_actor_discord_id = NULL,
          oauth_state_expires_at = NULL,
          oauth_state_next_path = NULL,
          updated_at = ?
      WHERE singleton_key = ?
    `).run(utcIso(), PLATFORM_SETTINGS_KEY);
    return this.getSettings(db);
  },

  getActiveBroadcaster(db = getDb()) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_broadcasters
      WHERE is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).get() as TwitchPlatformBroadcasterRow | undefined;
  },

  upsertBroadcaster(db, input) {
    ensurePlatformReady(db);
    const now = utcIso();
    const existing = db.prepare(`
      SELECT *
      FROM twitch_platform_broadcasters
      WHERE broadcaster_user_id = ?
      LIMIT 1
    `).get(input.broadcasterUserId) as TwitchPlatformBroadcasterRow | undefined;

    if (input.isActive ?? true) {
      db.prepare(`
        UPDATE twitch_platform_broadcasters
        SET is_active = 0
        WHERE is_active = 1
      `).run();
    }

    db.prepare(`
      INSERT INTO twitch_platform_broadcasters (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(broadcaster_user_id) DO UPDATE SET
        broadcaster_login = excluded.broadcaster_login,
        broadcaster_display_name = excluded.broadcaster_display_name,
        access_token = COALESCE(excluded.access_token, twitch_platform_broadcasters.access_token),
        refresh_token = COALESCE(excluded.refresh_token, twitch_platform_broadcasters.refresh_token),
        token_expires_at = COALESCE(excluded.token_expires_at, twitch_platform_broadcasters.token_expires_at),
        token_scope_json = excluded.token_scope_json,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).run(
      input.broadcasterUserId,
      input.broadcasterLogin,
      input.broadcasterDisplayName,
      input.accessToken ?? existing?.access_token ?? null,
      input.refreshToken ?? existing?.refresh_token ?? null,
      input.tokenExpiresAt ?? existing?.token_expires_at ?? null,
      JSON.stringify(input.scopes ?? jsonLoad<string[]>(existing?.token_scope_json, [])),
      input.isActive ?? true ? 1 : 0,
      existing?.created_at ?? now,
      now,
    );

    return db.prepare(`
      SELECT *
      FROM twitch_platform_broadcasters
      WHERE broadcaster_user_id = ?
      LIMIT 1
    `).get(input.broadcasterUserId) as TwitchPlatformBroadcasterRow;
  },

  clearBroadcasterConnection(db, broadcasterUserId) {
    ensurePlatformReady(db);
    db.prepare(`
      UPDATE twitch_platform_broadcasters
      SET access_token = NULL,
          refresh_token = NULL,
          token_expires_at = NULL,
          is_active = 0,
          updated_at = ?
      WHERE broadcaster_user_id = ?
    `).run(utcIso(), broadcasterUserId);
  },

  listSubscriptions(db = getDb()) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_subscriptions
      ORDER BY updated_at DESC, id DESC
    `).all() as TwitchPlatformSubscriptionRow[];
  },

  getSubscription(db, id) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_subscriptions
      WHERE id = ?
      LIMIT 1
    `).get(id) as TwitchPlatformSubscriptionRow | undefined;
  },

  upsertSubscription(db, input) {
    ensurePlatformReady(db);
    const now = utcIso();
    const existing = this.getSubscription(db, input.id);
    db.prepare(`
      INSERT INTO twitch_platform_subscriptions (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        module_key = excluded.module_key,
        subscription_type = excluded.subscription_type,
        subscription_version = excluded.subscription_version,
        broadcaster_user_id = COALESCE(excluded.broadcaster_user_id, twitch_platform_subscriptions.broadcaster_user_id),
        condition_json = excluded.condition_json,
        transport_method = COALESCE(excluded.transport_method, twitch_platform_subscriptions.transport_method),
        callback_url = COALESCE(excluded.callback_url, twitch_platform_subscriptions.callback_url),
        status = excluded.status,
        last_verified_at = COALESCE(excluded.last_verified_at, twitch_platform_subscriptions.last_verified_at),
        last_sync_attempt_at = COALESCE(excluded.last_sync_attempt_at, twitch_platform_subscriptions.last_sync_attempt_at),
        revoked_reason = excluded.revoked_reason,
        updated_at = excluded.updated_at
    `).run(
      input.id,
      input.moduleKey,
      input.subscriptionType,
      input.subscriptionVersion,
      input.broadcasterUserId ?? null,
      JSON.stringify(input.condition ?? {}),
      input.transportMethod ?? null,
      input.callbackUrl ?? null,
      input.status,
      input.lastVerifiedAt ?? null,
      input.lastSyncAttemptAt ?? null,
      input.revokedReason ?? null,
      existing?.created_at ?? now,
      now,
    );

    return this.getSubscription(db, input.id)!;
  },

  deleteSubscription(db, id) {
    ensurePlatformReady(db);
    db.prepare(`
      DELETE FROM twitch_platform_subscriptions
      WHERE id = ?
    `).run(id);
  },

  recordDelivery(db, input) {
    ensurePlatformReady(db);
    const result = db.prepare(`
      INSERT OR IGNORE INTO twitch_platform_deliveries (
        message_id,
        subscription_id,
        subscription_type,
        message_type,
        broadcaster_user_id,
        verified,
        processing_status,
        processing_attempts,
        raw_headers_json,
        raw_body,
        payload_json,
        received_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'received', 0, ?, ?, ?, ?)
    `).run(
      input.messageId,
      input.subscriptionId ?? null,
      input.subscriptionType ?? null,
      input.messageType,
      input.broadcasterUserId ?? null,
      input.verified ? 1 : 0,
      JSON.stringify(input.rawHeaders),
      input.rawBody,
      input.payloadJson,
      utcIso(),
    );

    return {
      inserted: result.changes > 0,
      row: this.getDelivery(db, input.messageId)!,
    };
  },

  getDelivery(db, messageId) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_deliveries
      WHERE message_id = ?
      LIMIT 1
    `).get(messageId) as TwitchPlatformDeliveryRow | undefined;
  },

  markDeliveryStatus(db, messageId, status, lastError) {
    ensurePlatformReady(db);
    db.prepare(`
      UPDATE twitch_platform_deliveries
      SET processing_status = ?,
          processing_attempts = processing_attempts + 1,
          processed_at = ?,
          last_error = ?
      WHERE message_id = ?
    `).run(status, utcIso(), lastError ?? null, messageId);
    return this.getDelivery(db, messageId)!;
  },

  listRecentDeliveries(db = getDb(), limit = 12) {
    ensurePlatformReady(db);
    return db.prepare(`
      SELECT *
      FROM twitch_platform_deliveries
      ORDER BY received_at DESC, message_id DESC
      LIMIT ?
    `).all(limit) as TwitchPlatformDeliveryRow[];
  },
};

export const twitchPlatformGateway: TwitchPlatformGateway = {
  async exchangeCode(code) {
    const config = assertTwitchOauthReady();
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formUrlEncoded({
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri!,
      }),
      cache: 'no-store',
    });
    const payload = await parseJsonResponse<TwitchTokenResponse>(response);
    if (!response.ok || !payload?.access_token) {
      twitchApiError('Unable to complete Twitch authorization', payload, 502);
    }
    return payload;
  },

  async refreshUserToken(refreshToken) {
    const config = assertTwitchOauthReady();
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formUrlEncoded({
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      cache: 'no-store',
    });
    const payload = await parseJsonResponse<TwitchTokenResponse>(response);
    if (!response.ok || !payload?.access_token) {
      twitchApiError('Unable to refresh the Twitch broadcaster token', payload, 502);
    }
    return payload;
  },

  async getAppAccessToken() {
    const config = assertTwitchEventSubReady();
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formUrlEncoded({
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
    });
    const payload = await parseJsonResponse<TwitchTokenResponse>(response);
    if (!response.ok || !payload?.access_token) {
      twitchApiError('Unable to fetch a Twitch app token', payload, 502);
    }
    return payload.access_token;
  },

  async getUserIdentity(accessToken) {
    const config = assertTwitchOauthReady();
    const response = await fetch('https://api.twitch.tv/helix/users', {
      method: 'GET',
      headers: {
        'Client-Id': config.clientId!,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });
    const payload = await parseJsonResponse<{ data?: TwitchUserIdentity[]; message?: string }>(response);
    const identity = payload?.data?.[0];
    if (!response.ok || !identity?.id) {
      twitchApiError('Unable to fetch the connected Twitch broadcaster profile', payload, 502);
    }
    return identity;
  },

  async ensureFreshBroadcaster(db) {
    let connection = twitchPlatformStore.getActiveBroadcaster(db);
    if (!connection?.access_token) {
      throw new AppError('Connect the Twitch broadcaster account first.', 401);
    }

    if (tokenExpiresSoon(connection.token_expires_at)) {
      if (!connection.refresh_token) {
        throw new AppError('The connected Twitch broadcaster token cannot be refreshed.', 401);
      }
      const refreshed = await this.refreshUserToken(connection.refresh_token);
      connection = twitchPlatformStore.upsertBroadcaster(db, {
        broadcasterUserId: connection.broadcaster_user_id,
        broadcasterLogin: connection.broadcaster_login,
        broadcasterDisplayName: connection.broadcaster_display_name,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? connection.refresh_token,
        tokenExpiresAt: utcIso(new Date(Date.now() + Math.max(0, Number(refreshed.expires_in ?? 0)) * 1000)),
        scopes: refreshed.scope ?? jsonLoad<string[]>(connection.token_scope_json, []),
        isActive: true,
      });
    }

    return connection;
  },

  async userApiRequest<T>(
    db: Database,
    input: {
      path: string;
      method?: 'GET' | 'POST' | 'PATCH';
      query?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
    },
  ) {
    const config = assertTwitchOauthReady();
    const url = new URL(`https://api.twitch.tv/helix${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    let connection = await this.ensureFreshBroadcaster(db);
    let response = await fetch(url, {
      method: input.method ?? 'GET',
      headers: {
        'Client-Id': config.clientId!,
        Authorization: `Bearer ${connection.access_token}`,
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: 'no-store',
    });

    if (response.status === 401 && connection.refresh_token) {
      const refreshed = await this.refreshUserToken(connection.refresh_token);
      connection = twitchPlatformStore.upsertBroadcaster(db, {
        broadcasterUserId: connection.broadcaster_user_id,
        broadcasterLogin: connection.broadcaster_login,
        broadcasterDisplayName: connection.broadcaster_display_name,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? connection.refresh_token,
        tokenExpiresAt: utcIso(new Date(Date.now() + Math.max(0, Number(refreshed.expires_in ?? 0)) * 1000)),
        scopes: refreshed.scope ?? jsonLoad<string[]>(connection.token_scope_json, []),
        isActive: true,
      });

      response = await fetch(url, {
        method: input.method ?? 'GET',
        headers: {
          'Client-Id': config.clientId!,
          Authorization: `Bearer ${connection.access_token}`,
          ...(input.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        cache: 'no-store',
      });
    }

    const payload = await parseJsonResponse<T & { message?: string }>(response);
    if (!response.ok) {
      twitchApiError('Twitch request failed', payload, response.status === 403 ? 403 : 502);
    }
    return payload as T;
  },

  async eventSubApiRequest<T>(
    input: {
      path: string;
      method?: 'GET' | 'POST' | 'DELETE';
      query?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
    },
  ) {
    const config = assertTwitchEventSubReady();
    const url = new URL(`https://api.twitch.tv/helix${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const appToken = await this.getAppAccessToken();
    const response = await fetch(url, {
      method: input.method ?? 'GET',
      headers: {
        'Client-Id': config.clientId!,
        Authorization: `Bearer ${appToken}`,
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: 'no-store',
    });
    const payload = await parseJsonResponse<T & { message?: string }>(response);
    if (!response.ok) {
      twitchApiError('Twitch EventSub request failed', payload, 502);
    }
    return payload as T;
  },
};

function buildAuthorizeUrl(state: string) {
  const config = assertTwitchOauthReady();
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', config.clientId!);
  url.searchParams.set('redirect_uri', config.redirectUri!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', TWITCH_PLATFORM_USER_SCOPES.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('force_verify', 'true');
  return url.toString();
}

function relevantWebhookHeaders(headers: Headers) {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase().startsWith('twitch-eventsub-') || key.toLowerCase() === 'content-type') {
      result[key] = value;
    }
  }
  return result;
}

function assertEventSubSignature(headers: Headers, rawBody: string) {
  const messageId = headers.get('Twitch-Eventsub-Message-Id') ?? '';
  const messageTimestamp = headers.get('Twitch-Eventsub-Message-Timestamp') ?? '';
  const signature = headers.get('Twitch-Eventsub-Message-Signature') ?? '';
  if (!messageId || !messageTimestamp || !signature) {
    throw new AppError('Missing Twitch EventSub signature headers.', 400);
  }

  const config = assertTwitchEventSubReady();
  const expected = `sha256=${crypto
    .createHmac('sha256', config.eventSubSecret!)
    .update(messageId + messageTimestamp + rawBody)
    .digest('hex')}`;

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new AppError('Invalid Twitch EventSub signature.', 403);
  }

  return {
    messageId,
    messageType: headers.get('Twitch-Eventsub-Message-Type') ?? EVENTSUB_MESSAGE_NOTIFICATION,
  };
}

function resolveModuleHandler(handlers: TwitchModuleHandler[], subscriptionType: string | null | undefined) {
  return handlers.find((handler) => handler.subscriptionTypes.includes(String(subscriptionType ?? '').trim()));
}

function upsertSubscriptionFromEnvelope(
  db: Database,
  envelope: TwitchEventEnvelope,
  handlers: TwitchModuleHandler[],
  deliveryMessageType: string,
) {
  const subscription = envelope.subscription;
  if (!subscription?.id || !subscription.type) return null;
  const matchedHandler = resolveModuleHandler(handlers, subscription.type);
  return twitchPlatformStore.upsertSubscription(db, {
    id: subscription.id,
    moduleKey: matchedHandler?.moduleKey ?? 'platform',
    subscriptionType: subscription.type,
    subscriptionVersion: subscription.version ?? '1',
    broadcasterUserId: subscription.condition?.broadcaster_user_id ?? null,
    condition: subscription.condition ?? {},
    transportMethod: subscription.transport?.method ?? 'webhook',
    callbackUrl: subscription.transport?.callback ?? null,
    status: subscription.status ?? 'enabled',
    lastVerifiedAt: deliveryMessageType === EVENTSUB_MESSAGE_VERIFICATION ? utcIso() : undefined,
    lastSyncAttemptAt: utcIso(),
    revokedReason: deliveryMessageType === EVENTSUB_MESSAGE_REVOCATION ? subscription.status ?? 'revoked' : null,
  });
}

export async function beginTwitchPlatformConnect(actor: TwitchOperatorUser, nextPath?: string | null) {
  const db = getDb();
  assertTwitchOauthReady();
  const oauthState = randomToken(20);
  twitchPlatformStore.saveOauthState(db, {
    state: oauthState,
    actorDiscordId: actor.discord_id,
    nextPath: normalizedNextPath(nextPath),
    expiresAt: utcIso(new Date(Date.now() + OAUTH_STATE_LIFETIME_MS)),
  });

  return {
    authorizeUrl: buildAuthorizeUrl(oauthState),
  };
}

export async function completeTwitchPlatformConnect(params: {
  code?: string | null;
  state?: string | null;
  actor: TwitchOperatorUser;
}) {
  const db = getDb();
  const settings = twitchPlatformStore.getSettings(db);
  const code = String(params.code ?? '').trim();
  const state = String(params.state ?? '').trim();
  const stateExpiresAt = parseIso(settings.oauth_state_expires_at);

  if (!code || !state) {
    throw new AppError('The Twitch callback is missing its code or state.', 400);
  }
  if (!settings.oauth_state || settings.oauth_state !== state) {
    throw new AppError('The Twitch authorization state is invalid or expired.', 400);
  }
  if (!stateExpiresAt || stateExpiresAt.getTime() < Date.now()) {
    throw new AppError('The Twitch authorization state expired. Start the connection again.', 400);
  }
  if (settings.oauth_state_actor_discord_id && settings.oauth_state_actor_discord_id !== params.actor.discord_id) {
    throw new AppError('This Twitch authorization belongs to a different operator session.', 403);
  }

  const nextPath = normalizedNextPath(settings.oauth_state_next_path);
  const token = await twitchPlatformGateway.exchangeCode(code);
  const identity = await twitchPlatformGateway.getUserIdentity(token.access_token);

  twitchPlatformStore.upsertBroadcaster(db, {
    broadcasterUserId: identity.id,
    broadcasterLogin: identity.login,
    broadcasterDisplayName: identity.display_name,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: utcIso(new Date(Date.now() + Math.max(0, Number(token.expires_in ?? 0)) * 1000)),
    scopes: token.scope ?? [],
    isActive: true,
  });
  twitchPlatformStore.clearOauthState(db);

  return {
    nextPath,
    connection: mapBroadcasterConnection(twitchPlatformStore.getActiveBroadcaster(db)!),
  };
}

export async function buildTwitchPlatformState(
  actor: TwitchOperatorUser,
  handlers: TwitchModuleHandler[],
): Promise<TwitchPlatformState> {
  const db = getDb();
  const config = getTwitchPlatformConfig();
  const connection = twitchPlatformStore.getActiveBroadcaster(db);
  const modules = await Promise.all(handlers.map((handler) => Promise.resolve(handler.buildHealth(db))));

  return {
    operator: {
      displayName: displayName(actor),
      discordId: actor.discord_id,
    },
    config: {
      operatorAllowlistConfigured: config.operatorAllowlistConfigured,
      oauthReady: config.oauthReady,
      eventSubReady: config.eventSubReady,
      redirectUri: config.redirectUri ?? null,
      callbackUrl: config.callbackUrl ?? null,
    },
    connection: connection ? mapBroadcasterConnection(connection) : null,
    subscriptions: twitchPlatformStore.listSubscriptions(db).map(mapSubscription),
    recentDeliveries: twitchPlatformStore.listRecentDeliveries(db).map(mapDelivery),
    modules,
  };
}

export async function syncTwitchPlatformSubscriptions(handlers: TwitchModuleHandler[]) {
  const db = getDb();
  const operator = await requireTwitchPlatformOperator();
  const connection = await twitchPlatformGateway.ensureFreshBroadcaster(db);
  const config = assertTwitchEventSubReady();

  for (const handler of handlers) {
    await handler.syncSubscriptions({
      db,
      config,
      connection,
      gateway: twitchPlatformGateway,
      store: twitchPlatformStore,
    });
  }

  return buildTwitchPlatformState(operator, handlers);
}

export async function disconnectTwitchPlatform(handlers: TwitchModuleHandler[]) {
  const db = getDb();
  const operator = await requireTwitchPlatformOperator();
  const connection = twitchPlatformStore.getActiveBroadcaster(db);
  if (!connection) {
    return buildTwitchPlatformState(operator, handlers);
  }

  const config = getTwitchPlatformConfig();
  const context: TwitchModuleContext = {
    db,
    config,
    connection,
    gateway: twitchPlatformGateway,
    store: twitchPlatformStore,
  };

  for (const handler of handlers) {
    if (handler.disconnect) {
      await handler.disconnect(context);
    }
  }

  const subscriptions = twitchPlatformStore.listSubscriptions(db)
    .filter((subscription) => subscription.broadcaster_user_id === connection.broadcaster_user_id);

  if (config.eventSubReady) {
    for (const subscription of subscriptions) {
      await twitchPlatformGateway.eventSubApiRequest({
        path: '/eventsub/subscriptions',
        method: 'DELETE',
        query: { id: subscription.id },
      });
    }
  }

  for (const subscription of subscriptions) {
    twitchPlatformStore.deleteSubscription(db, subscription.id);
  }

  twitchPlatformStore.clearBroadcasterConnection(db, connection.broadcaster_user_id);
  twitchPlatformStore.clearOauthState(db);
  return buildTwitchPlatformState(operator, handlers);
}

export const twitchEventProcessor: TwitchEventProcessor = {
  async processPersistedDelivery(messageId, handlers) {
    const db = getDb();
    const delivery = twitchPlatformStore.getDelivery(db, messageId);
    if (!delivery) {
      throw new AppError('That Twitch delivery does not exist.', 404);
    }

    const envelope = jsonLoad<TwitchEventEnvelope>(delivery.payload_json || delivery.raw_body, {});
    upsertSubscriptionFromEnvelope(db, envelope, handlers, delivery.message_type);

    if (delivery.message_type === EVENTSUB_MESSAGE_VERIFICATION) {
      twitchPlatformStore.markDeliveryStatus(db, messageId, 'processed');
      return new Response(String(envelope.challenge ?? ''), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (delivery.message_type === EVENTSUB_MESSAGE_REVOCATION) {
      twitchPlatformStore.markDeliveryStatus(db, messageId, 'processed');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (delivery.message_type !== EVENTSUB_MESSAGE_NOTIFICATION) {
      twitchPlatformStore.markDeliveryStatus(db, messageId, 'ignored');
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const handler = resolveModuleHandler(handlers, delivery.subscription_type ?? envelope.subscription?.type);
    if (!handler) {
      twitchPlatformStore.markDeliveryStatus(db, messageId, 'ignored');
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const connection = await twitchPlatformGateway.ensureFreshBroadcaster(db);
      const outcome = await handler.processDelivery({
        db,
        config: getTwitchPlatformConfig(),
        connection,
        gateway: twitchPlatformGateway,
        store: twitchPlatformStore,
        delivery,
        envelope,
      });

      twitchPlatformStore.markDeliveryStatus(db, messageId, outcome === 'ignored' ? 'ignored' : 'processed');
      return new Response(JSON.stringify({ ok: true, ignored: outcome === 'ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Twitch delivery processing failed.';
      twitchPlatformStore.markDeliveryStatus(db, messageId, 'failed', message);
      throw error;
    }
  },

  async handleWebhookRequest(request, handlers) {
    const db = getDb();
    const rawBody = await request.text();
    const envelope = rawBody ? JSON.parse(rawBody) as TwitchEventEnvelope : {};
    const signature = assertEventSubSignature(request.headers, rawBody);
    const delivery = twitchPlatformStore.recordDelivery(db, {
      messageId: signature.messageId,
      subscriptionId: envelope.subscription?.id ?? null,
      subscriptionType: envelope.subscription?.type ?? null,
      messageType: signature.messageType,
      broadcasterUserId: envelope.subscription?.condition?.broadcaster_user_id ?? null,
      verified: true,
      rawHeaders: relevantWebhookHeaders(request.headers),
      rawBody,
      payloadJson: rawBody || '{}',
    });

    if (!delivery.inserted) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return this.processPersistedDelivery(signature.messageId, handlers);
  },
};

export async function replayTwitchPlatformDelivery(messageId: string, handlers: TwitchModuleHandler[]) {
  return twitchEventProcessor.processPersistedDelivery(messageId, handlers);
}

export function recentTwitchPlatformDeliveriesForTests(limit = 20) {
  return twitchPlatformStore.listRecentDeliveries(getDb(), limit);
}
