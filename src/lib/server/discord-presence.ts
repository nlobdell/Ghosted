import 'server-only';

import { parseIso, utcIso } from '@/lib/server/core';
import { buildRuntimeAuthConfig } from '@/lib/server/discord';
import { getDatabase } from '@/lib/server/database';
import type {
  DiscordPresenceBotInstallStatus,
  DiscordPresenceChannelType,
  DiscordPresenceWorkerHealth,
  DiscordPresenceWorkerSummary,
  DiscordPresenceWorkerRuntimeStatus,
  DiscordPresenceWorkerState,
  DiscordVoicePresenceRow,
  ScenePresenceChannelAllowlistEntry,
} from '@/lib/types';

export const DISCORD_PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;
export const DISCORD_PRESENCE_STALE_AFTER_MS = 45_000;

type DiscordVoicePresenceRecord = {
  guild_id: string;
  discord_id: string;
  channel_id: string;
  display_name: string;
  username: string;
  joined_at: string;
  last_seen_at: string;
};

type ScenePresenceChannelAllowlistRecord = {
  guild_id: string;
  channel_id: string;
  channel_name: string;
  channel_type: DiscordPresenceChannelType;
  updated_at: string;
};

type DiscordPresenceWorkerStateRecord = {
  guild_id: string;
  runtime_status: DiscordPresenceWorkerRuntimeStatus;
  bot_install_status: DiscordPresenceBotInstallStatus;
  last_heartbeat_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type UpsertDiscordVoicePresenceInput = {
  guildId: string;
  discordId: string;
  channelId: string;
  displayName: string;
  username: string;
  joinedAt: string;
  lastSeenAt: string;
};

type ReplaceScenePresenceChannelAllowlistInput = Array<{
  channelId: string;
  channelName: string;
  channelType: DiscordPresenceChannelType;
}>;

type UpsertDiscordPresenceWorkerStateInput = {
  guildId?: string | null;
  runtimeStatus?: DiscordPresenceWorkerRuntimeStatus;
  botInstallStatus?: DiscordPresenceBotInstallStatus;
  lastHeartbeatAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

function mapDiscordVoicePresence(row: DiscordVoicePresenceRecord): DiscordVoicePresenceRow {
  return {
    guildId: row.guild_id,
    discordId: row.discord_id,
    channelId: row.channel_id,
    displayName: row.display_name,
    username: row.username,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapScenePresenceChannelAllowlist(
  row: ScenePresenceChannelAllowlistRecord,
): ScenePresenceChannelAllowlistEntry {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelType: row.channel_type,
    updatedAt: row.updated_at,
  };
}

function mapDiscordPresenceWorkerState(
  row: DiscordPresenceWorkerStateRecord,
): DiscordPresenceWorkerState {
  return {
    guildId: row.guild_id,
    runtimeStatus: row.runtime_status,
    botInstallStatus: row.bot_install_status,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

export function discordPresenceWorkerConfigured() {
  const { guildId, botToken } = buildRuntimeAuthConfig();
  return Boolean(guildId && botToken);
}

export function currentDiscordPresenceGuildId() {
  return buildRuntimeAuthConfig().guildId ?? null;
}

function resolveGuildId(guildId?: string | null) {
  const resolved = String(guildId ?? currentDiscordPresenceGuildId() ?? '').trim();
  return resolved || null;
}

export function getDiscordVoicePresence(
  db = getDatabase(),
  guildId?: string | null,
  discordId?: string | null,
) {
  const resolvedGuildId = resolveGuildId(guildId);
  const resolvedDiscordId = String(discordId ?? '').trim();
  if (!resolvedGuildId || !resolvedDiscordId) return null;

  const row = db.prepare(`
    SELECT guild_id, discord_id, channel_id, display_name, username, joined_at, last_seen_at
    FROM discord_voice_presence
    WHERE guild_id = ? AND discord_id = ?
  `).get(resolvedGuildId, resolvedDiscordId) as DiscordVoicePresenceRecord | undefined;

  return row ? mapDiscordVoicePresence(row) : null;
}

export function listDiscordVoicePresence(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) return [] as DiscordVoicePresenceRow[];

  const rows = db.prepare(`
    SELECT guild_id, discord_id, channel_id, display_name, username, joined_at, last_seen_at
    FROM discord_voice_presence
    WHERE guild_id = ?
    ORDER BY last_seen_at DESC, discord_id ASC
  `).all(resolvedGuildId) as DiscordVoicePresenceRecord[];

  return rows.map(mapDiscordVoicePresence);
}

export function upsertDiscordVoicePresence(
  db = getDatabase(),
  input: UpsertDiscordVoicePresenceInput,
) {
  db.prepare(`
    INSERT INTO discord_voice_presence (
      guild_id,
      discord_id,
      channel_id,
      display_name,
      username,
      joined_at,
      last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, discord_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      display_name = excluded.display_name,
      username = excluded.username,
      joined_at = excluded.joined_at,
      last_seen_at = excluded.last_seen_at
  `).run(
    input.guildId,
    input.discordId,
    input.channelId,
    input.displayName,
    input.username,
    utcIso(input.joinedAt),
    utcIso(input.lastSeenAt),
  );

  return getDiscordVoicePresence(db, input.guildId, input.discordId);
}

export function deleteDiscordVoicePresence(
  db = getDatabase(),
  guildId: string,
  discordId: string,
) {
  db.prepare(`
    DELETE FROM discord_voice_presence
    WHERE guild_id = ? AND discord_id = ?
  `).run(guildId, discordId);
}

export function clearDiscordVoicePresence(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) {
    db.prepare('DELETE FROM discord_voice_presence').run();
    return;
  }

  db.prepare(`
    DELETE FROM discord_voice_presence
    WHERE guild_id = ?
  `).run(resolvedGuildId);
}

export function listScenePresenceChannelAllowlist(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) return [] as ScenePresenceChannelAllowlistEntry[];

  const rows = db.prepare(`
    SELECT guild_id, channel_id, channel_name, channel_type, updated_at
    FROM scene_presence_channel_allowlist
    WHERE guild_id = ?
    ORDER BY channel_name COLLATE NOCASE ASC, channel_id ASC
  `).all(resolvedGuildId) as ScenePresenceChannelAllowlistRecord[];

  return rows.map(mapScenePresenceChannelAllowlist);
}

export function replaceScenePresenceChannelAllowlist(
  db = getDatabase(),
  guildId: string,
  entries: ReplaceScenePresenceChannelAllowlistInput,
) {
  const normalizedGuildId = resolveGuildId(guildId);
  if (!normalizedGuildId) {
    throw new Error('Discord guild id is required to update the scene presence channel allowlist.');
  }

  const normalizedEntries = entries.map((entry) => ({
    channelId: String(entry.channelId).trim(),
    channelName: String(entry.channelName).trim(),
    channelType: entry.channelType,
  })).filter((entry) => entry.channelId && entry.channelName);

  const timestamp = utcIso();
  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM scene_presence_channel_allowlist
      WHERE guild_id = ?
    `).run(normalizedGuildId);

    const insert = db.prepare(`
      INSERT INTO scene_presence_channel_allowlist (
        guild_id,
        channel_id,
        channel_name,
        channel_type,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const entry of normalizedEntries) {
      insert.run(
        normalizedGuildId,
        entry.channelId,
        entry.channelName,
        entry.channelType,
        timestamp,
      );
    }
  });

  transaction();
  return listScenePresenceChannelAllowlist(db, normalizedGuildId);
}

export function clearScenePresenceChannelAllowlist(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) {
    db.prepare('DELETE FROM scene_presence_channel_allowlist').run();
    return;
  }

  db.prepare(`
    DELETE FROM scene_presence_channel_allowlist
    WHERE guild_id = ?
  `).run(resolvedGuildId);
}

export function getDiscordPresenceWorkerState(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) return null;

  const row = db.prepare(`
    SELECT
      guild_id,
      runtime_status,
      bot_install_status,
      last_heartbeat_at,
      last_sync_at,
      last_error,
      updated_at
    FROM discord_presence_worker_state
    WHERE guild_id = ?
  `).get(resolvedGuildId) as DiscordPresenceWorkerStateRecord | undefined;

  return row ? mapDiscordPresenceWorkerState(row) : null;
}

export function upsertDiscordPresenceWorkerState(
  db = getDatabase(),
  input: UpsertDiscordPresenceWorkerStateInput,
) {
  const guildId = resolveGuildId(input.guildId);
  if (!guildId) {
    throw new Error('Discord guild id is required to update the presence worker state.');
  }

  const existing = getDiscordPresenceWorkerState(db, guildId);
  const nextState: DiscordPresenceWorkerState = {
    guildId,
    runtimeStatus: input.runtimeStatus ?? existing?.runtimeStatus ?? 'idle',
    botInstallStatus: input.botInstallStatus ?? existing?.botInstallStatus ?? 'unknown',
    lastHeartbeatAt: input.lastHeartbeatAt ?? existing?.lastHeartbeatAt ?? null,
    lastSyncAt: input.lastSyncAt ?? existing?.lastSyncAt ?? null,
    lastError: input.lastError ?? existing?.lastError ?? null,
    updatedAt: utcIso(),
  };

  db.prepare(`
    INSERT INTO discord_presence_worker_state (
      guild_id,
      runtime_status,
      bot_install_status,
      last_heartbeat_at,
      last_sync_at,
      last_error,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      runtime_status = excluded.runtime_status,
      bot_install_status = excluded.bot_install_status,
      last_heartbeat_at = excluded.last_heartbeat_at,
      last_sync_at = excluded.last_sync_at,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run(
    nextState.guildId,
    nextState.runtimeStatus,
    nextState.botInstallStatus,
    nextState.lastHeartbeatAt,
    nextState.lastSyncAt,
    nextState.lastError,
    nextState.updatedAt,
  );

  return getDiscordPresenceWorkerState(db, guildId);
}

export function clearDiscordPresenceWorkerState(db = getDatabase(), guildId?: string | null) {
  const resolvedGuildId = resolveGuildId(guildId);
  if (!resolvedGuildId) {
    db.prepare('DELETE FROM discord_presence_worker_state').run();
    return;
  }

  db.prepare(`
    DELETE FROM discord_presence_worker_state
    WHERE guild_id = ?
  `).run(resolvedGuildId);
}

export function resolveDiscordPresenceWorkerHealth(
  state: DiscordPresenceWorkerState | null,
  options: {
    configured?: boolean;
    nowMs?: number;
    staleAfterMs?: number;
  } = {},
): DiscordPresenceWorkerHealth {
  const configured = options.configured ?? discordPresenceWorkerConfigured();
  if (!configured) return 'not-configured';
  if (!state) return 'idle';
  if (state.runtimeStatus === 'error') return 'error';
  if (state.botInstallStatus === 'not-installed') return 'not-installed';
  if (state.runtimeStatus === 'idle') return 'idle';

  const lastHeartbeat = parseIso(state.lastHeartbeatAt);
  if (!lastHeartbeat) return 'stale';

  const nowMs = options.nowMs ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? DISCORD_PRESENCE_STALE_AFTER_MS;
  return nowMs - lastHeartbeat.getTime() > staleAfterMs ? 'stale' : 'healthy';
}

export function getDiscordPresenceWorkerHealth(db = getDatabase(), guildId?: string | null) {
  const state = getDiscordPresenceWorkerState(db, guildId);
  return resolveDiscordPresenceWorkerHealth(state);
}

export function getDiscordPresenceWorkerSummary(
  db = getDatabase(),
  guildId?: string | null,
): DiscordPresenceWorkerSummary {
  const resolvedGuildId = resolveGuildId(guildId);
  const configured = discordPresenceWorkerConfigured();
  const state = resolvedGuildId ? getDiscordPresenceWorkerState(db, resolvedGuildId) : null;
  return {
    configured,
    guildId: resolvedGuildId,
    health: resolveDiscordPresenceWorkerHealth(state, { configured }),
    state,
  };
}

export function resetDiscordPresenceFoundationState(db = getDatabase()) {
  clearDiscordVoicePresence(db);
  clearScenePresenceChannelAllowlist(db);
  clearDiscordPresenceWorkerState(db);
}
