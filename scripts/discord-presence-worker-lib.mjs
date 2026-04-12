import Database from 'better-sqlite3';
import path from 'node:path';
import process from 'node:process';
import { Client, GatewayIntentBits } from 'discord.js';

export const DISCORD_PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;

export function envText(name, env = process.env) {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

export function isoNow(date = new Date()) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

export function resolveDiscordPresenceDatabasePath(env = process.env) {
  return envText('DATABASE_PATH', env)
    ? path.resolve(env.DATABASE_PATH)
    : path.resolve(process.cwd(), 'data', 'ghosted.db');
}

export function resolveDiscordPresenceWorkerConfig(env = process.env) {
  const guildId = envText('DISCORD_GUILD_ID', env);
  const botToken = envText('DISCORD_BOT_TOKEN', env);

  return {
    guildId: guildId ?? null,
    botToken: botToken ?? null,
    configured: Boolean(guildId && botToken),
    databasePath: resolveDiscordPresenceDatabasePath(env),
  };
}

export function ensureDiscordPresenceFoundationSchema(db) {
  db.exec(`
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
  `);
}

export function openDiscordPresenceDatabase(env = process.env) {
  const db = new Database(resolveDiscordPresenceDatabasePath(env));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  ensureDiscordPresenceFoundationSchema(db);
  return db;
}

function readVoicePresenceRow(db, guildId, discordId) {
  return db.prepare(`
    SELECT guild_id, discord_id, channel_id, display_name, username, joined_at, last_seen_at
    FROM discord_voice_presence
    WHERE guild_id = ? AND discord_id = ?
  `).get(guildId, discordId);
}

export function listVoicePresenceRows(db, guildId) {
  return db.prepare(`
    SELECT guild_id, discord_id, channel_id, display_name, username, joined_at, last_seen_at
    FROM discord_voice_presence
    WHERE guild_id = ?
    ORDER BY last_seen_at DESC, discord_id ASC
  `).all(guildId);
}

export function clearVoicePresenceRows(db, guildId) {
  db.prepare(`
    DELETE FROM discord_voice_presence
    WHERE guild_id = ?
  `).run(guildId);
}

export function removeVoicePresenceMember(db, guildId, discordId) {
  db.prepare(`
    DELETE FROM discord_voice_presence
    WHERE guild_id = ? AND discord_id = ?
  `).run(guildId, discordId);
}

export function upsertVoicePresenceMember(db, guildId, entry, nowIso = isoNow()) {
  const existing = readVoicePresenceRow(db, guildId, entry.discordId);
  const joinedAt = existing && existing.channel_id === entry.channelId
    ? existing.joined_at
    : entry.joinedAt
      ? isoNow(entry.joinedAt)
      : nowIso;

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
    guildId,
    entry.discordId,
    entry.channelId,
    entry.displayName,
    entry.username,
    joinedAt,
    isoNow(entry.lastSeenAt ?? nowIso),
  );

  return readVoicePresenceRow(db, guildId, entry.discordId);
}

export function syncGuildVoiceSnapshot(db, guildId, entries, nowIso = isoNow()) {
  const normalized = [];
  const seen = new Set();

  for (const entry of entries) {
    const discordId = String(entry.discordId ?? '').trim();
    const channelId = String(entry.channelId ?? '').trim();
    const username = String(entry.username ?? '').trim();
    const displayName = String(entry.displayName ?? username).trim() || username;
    if (!discordId || !channelId || !username || seen.has(discordId)) continue;
    seen.add(discordId);
    normalized.push({
      discordId,
      channelId,
      username,
      displayName,
      joinedAt: entry.joinedAt ?? nowIso,
      lastSeenAt: entry.lastSeenAt ?? nowIso,
    });
  }

  const transaction = db.transaction(() => {
    const existingIds = new Set(
      db.prepare(`
        SELECT discord_id
        FROM discord_voice_presence
        WHERE guild_id = ?
      `).all(guildId).map((row) => String(row.discord_id)),
    );

    for (const entry of normalized) {
      upsertVoicePresenceMember(db, guildId, entry, nowIso);
      existingIds.delete(entry.discordId);
    }

    for (const discordId of existingIds) {
      removeVoicePresenceMember(db, guildId, discordId);
    }
  });

  transaction();
  return listVoicePresenceRows(db, guildId);
}

export function refreshActiveMemberIdentity(db, guildId, discordId, patch) {
  const row = readVoicePresenceRow(db, guildId, discordId);
  if (!row) return null;

  const nextUsername = String(patch.username ?? row.username).trim() || row.username;
  const nextDisplayName = String(patch.displayName ?? nextUsername).trim() || nextUsername;

  db.prepare(`
    UPDATE discord_voice_presence
    SET display_name = ?, username = ?, last_seen_at = ?
    WHERE guild_id = ? AND discord_id = ?
  `).run(
    nextDisplayName,
    nextUsername,
    isoNow(),
    guildId,
    discordId,
  );

  return readVoicePresenceRow(db, guildId, discordId);
}

export function readWorkerState(db, guildId) {
  return db.prepare(`
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
  `).get(guildId);
}

export function writeWorkerState(db, guildId, patch, nowIso = isoNow()) {
  const existing = readWorkerState(db, guildId);
  const nextState = {
    guildId,
    runtimeStatus: patch.runtimeStatus ?? existing?.runtime_status ?? 'idle',
    botInstallStatus: patch.botInstallStatus ?? existing?.bot_install_status ?? 'unknown',
    lastHeartbeatAt: patch.lastHeartbeatAt ?? existing?.last_heartbeat_at ?? null,
    lastSyncAt: patch.lastSyncAt ?? existing?.last_sync_at ?? null,
    lastError: patch.lastError ?? existing?.last_error ?? null,
    updatedAt: nowIso,
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

  return readWorkerState(db, guildId);
}

export function recordWorkerHeartbeat(db, guildId, nowIso = isoNow()) {
  return writeWorkerState(db, guildId, {
    runtimeStatus: 'running',
    lastHeartbeatAt: nowIso,
  }, nowIso);
}

export function recordWorkerSync(db, guildId, patch = {}, nowIso = isoNow()) {
  return writeWorkerState(db, guildId, {
    runtimeStatus: 'running',
    botInstallStatus: 'installed',
    lastHeartbeatAt: nowIso,
    lastSyncAt: nowIso,
    lastError: null,
    ...patch,
  }, nowIso);
}

export function recordWorkerNotInstalled(db, guildId, reason = 'Bot is not installed in the configured guild.', nowIso = isoNow()) {
  clearVoicePresenceRows(db, guildId);
  return writeWorkerState(db, guildId, {
    runtimeStatus: 'running',
    botInstallStatus: 'not-installed',
    lastHeartbeatAt: nowIso,
    lastError: reason,
  }, nowIso);
}

export function recordWorkerError(db, guildId, error, nowIso = isoNow()) {
  const message = error instanceof Error ? error.message : String(error);
  return writeWorkerState(db, guildId, {
    runtimeStatus: 'error',
    lastHeartbeatAt: nowIso,
    lastError: message,
  }, nowIso);
}

function resolveDisplayName(member, fallbackUsername) {
  const displayName = member?.displayName
    ?? member?.nickname
    ?? member?.user?.globalName
    ?? fallbackUsername;
  const normalized = String(displayName ?? fallbackUsername).trim();
  return normalized || fallbackUsername;
}

export function voicePresenceFromVoiceState(state, nowIso = isoNow()) {
  const user = state?.member?.user ?? state?.user ?? null;
  const discordId = String(
    state?.id
      ?? state?.member?.id
      ?? user?.id
      ?? '',
  ).trim();
  const channelId = String(state?.channelId ?? state?.channel_id ?? '').trim();
  const username = String(user?.username ?? '').trim();
  const isBot = Boolean(user?.bot);

  if (!discordId || !channelId || !username || isBot) return null;

  return {
    discordId,
    channelId,
    username,
    displayName: resolveDisplayName(state?.member, username),
    joinedAt: nowIso,
    lastSeenAt: nowIso,
  };
}

export async function buildVoicePresenceSnapshotFromGuild(guild, nowIso = isoNow()) {
  const snapshot = [];

  for (const voiceState of guild.voiceStates.cache.values()) {
    let normalized = voicePresenceFromVoiceState(voiceState, nowIso);
    if (!normalized && voiceState?.id) {
      try {
        const member = await guild.members.fetch(voiceState.id);
        normalized = voicePresenceFromVoiceState({
          ...voiceState,
          member,
        }, nowIso);
      } catch {
        normalized = null;
      }
    }

    if (normalized) snapshot.push(normalized);
  }

  return snapshot;
}

export function applyVoiceStateUpdate(db, guildId, oldState, newState, nowIso = isoNow()) {
  const nextPresence = voicePresenceFromVoiceState(newState, nowIso);
  if (nextPresence) {
    upsertVoicePresenceMember(db, guildId, nextPresence, nowIso);
    return { action: 'upsert', discordId: nextPresence.discordId };
  }

  const discordId = String(
    newState?.id
      ?? oldState?.id
      ?? newState?.member?.id
      ?? oldState?.member?.id
      ?? newState?.member?.user?.id
      ?? oldState?.member?.user?.id
      ?? '',
  ).trim();

  if (!discordId) return { action: 'noop', discordId: null };

  removeVoicePresenceMember(db, guildId, discordId);
  return { action: 'delete', discordId };
}

function isNotInstalledError(error) {
  const code = Number(error?.code ?? NaN);
  return code === 10004 || code === 50001;
}

function readWorkerErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isDisallowedIntentsError(error) {
  const code = Number(error?.code ?? error?.closeCode ?? NaN);
  const message = readWorkerErrorMessage(error).toLowerCase();
  return code === 4014 || message.includes('used disallowed intents') || message.includes('disallowed intents');
}

export function formatDiscordWorkerError(error) {
  const message = readWorkerErrorMessage(error);
  if (isDisallowedIntentsError(error)) {
    return `${message} Enable Server Members Intent in the Discord Developer Portal for this bot application, save the bot settings, and restart the Discord worker.`;
  }

  return message;
}

function normalizeWorkerModules(modules) {
  const seen = new Set();
  const normalized = [];

  for (const workerModule of modules) {
    if (!workerModule || typeof workerModule !== 'object') continue;
    const key = String(workerModule.key ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(workerModule);
  }

  return normalized;
}

function buildWorkerIntents(modules) {
  const intents = new Set([GatewayIntentBits.Guilds]);
  for (const workerModule of modules) {
    for (const intent of workerModule.intents ?? []) {
      intents.add(intent);
    }
  }
  return Array.from(intents);
}

function createDefaultClient(intents) {
  return new Client({ intents });
}

export function createDiscordVoicePresenceModule() {
  async function syncConfiguredGuild(context, reason = 'manual') {
    const { client, config, db, logger, nowIso, recordNotInstalled, recordSync, recordError } = context;
    if (!config.configured || !config.guildId || !client) return;

    const timestamp = nowIso();
    try {
      const guild = client.guilds.cache.get(config.guildId) ?? await client.guilds.fetch(config.guildId);
      if (!guild) {
        recordNotInstalled('Configured guild was not found for the Discord worker.', timestamp);
        return;
      }

      const snapshot = await buildVoicePresenceSnapshotFromGuild(guild, timestamp);
      syncGuildVoiceSnapshot(db, config.guildId, snapshot, timestamp);
      recordSync({ lastError: null, reason }, timestamp);
    } catch (error) {
      if (isNotInstalledError(error)) {
        recordNotInstalled('Bot is not installed in the configured guild or cannot access it.', timestamp);
        return;
      }

      recordError(error, timestamp);
      logger.error('[discord-worker] voicePresence sync failed.', error);
    }
  }

  return {
    key: 'voicePresence',
    intents: [
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
    syncConfiguredGuild,
    async onReady(context) {
      await syncConfiguredGuild(context, 'ready');
    },
    async onGuildCreate(context, guild) {
      if (guild?.id !== context.config.guildId) return;
      await syncConfiguredGuild(context, 'guildCreate');
    },
    onGuildDelete(context, guild) {
      if (guild?.id !== context.config.guildId) return;
      context.recordNotInstalled('Bot was removed from the configured guild.', context.nowIso());
    },
    onVoiceStateUpdate(context, oldState, newState) {
      const guildId = newState?.guild?.id ?? oldState?.guild?.id ?? null;
      if (!guildId || guildId !== context.config.guildId) return;

      applyVoiceStateUpdate(context.db, guildId, oldState, newState, context.nowIso());
      context.recordSync({}, context.nowIso());
    },
    onGuildMemberUpdate(context, _oldMember, newMember) {
      if (!newMember || newMember.guild?.id !== context.config.guildId || newMember.user?.bot) return;
      refreshActiveMemberIdentity(context.db, context.config.guildId, newMember.id, {
        displayName: resolveDisplayName(newMember, newMember.user.username),
        username: newMember.user.username,
      });
    },
  };
}

export function createDiscordWorkerHost(options = {}) {
  const env = options.env ?? process.env;
  const config = resolveDiscordPresenceWorkerConfig(env);
  const logger = options.logger ?? console;
  const now = options.now ?? (() => new Date());
  const modules = normalizeWorkerModules(options.modules ?? []);
  const moduleKeys = modules.map((workerModule) => workerModule.key);
  const createClient = options.createClient ?? createDefaultClient;
  const db = options.db ?? openDiscordPresenceDatabase(env);
  const setHeartbeatInterval = options.setHeartbeatInterval ?? setInterval;
  const clearHeartbeatInterval = options.clearHeartbeatInterval ?? clearInterval;

  let client = null;
  let heartbeatId = null;
  let stopped = false;

  function nextIso() {
    return isoNow(now());
  }

  function buildContext() {
    return {
      client,
      db,
      config,
      logger,
      moduleKeys,
      nowIso: nextIso,
      recordHeartbeat(timestamp = nextIso()) {
        if (!config.guildId) return null;
        return recordWorkerHeartbeat(db, config.guildId, timestamp);
      },
      recordSync(patch = {}, timestamp = nextIso()) {
        if (!config.guildId) return null;
        return recordWorkerSync(db, config.guildId, patch, timestamp);
      },
      recordNotInstalled(reason, timestamp = nextIso()) {
        if (!config.guildId) return null;
        return recordWorkerNotInstalled(db, config.guildId, reason, timestamp);
      },
      recordError(error, timestamp = nextIso()) {
        if (!config.guildId) return null;
        return recordWorkerError(db, config.guildId, error, timestamp);
      },
    };
  }

  function recordAndLogWorkerError(label, error) {
    const message = formatDiscordWorkerError(error);
    if (config.configured && config.guildId) {
      recordWorkerError(db, config.guildId, message, nextIso());
    }

    if (message === readWorkerErrorMessage(error)) {
      logger.error(label, error);
      return;
    }

    logger.error(`${label} ${message}`);
  }

  async function runModuleHook(workerModule, hook, ...args) {
    const handler = workerModule?.[hook];
    if (typeof handler !== 'function') return undefined;

    try {
      return await handler(buildContext(), ...args);
    } catch (error) {
      if (config.configured && config.guildId) {
        recordWorkerError(db, config.guildId, error, nextIso());
      }
      logger.error(`[discord-worker] ${workerModule.key}.${hook} failed.`, error);
      return undefined;
    }
  }

  async function runAllModules(hook, ...args) {
    for (const workerModule of modules) {
      await runModuleHook(workerModule, hook, ...args);
    }
  }

  async function runModule(moduleKey, hook, ...args) {
    const workerModule = modules.find((entry) => entry.key === moduleKey);
    if (!workerModule) return undefined;
    return runModuleHook(workerModule, hook, ...args);
  }

  function startHeartbeat() {
    if (!config.configured || !config.guildId || heartbeatId) return;
    heartbeatId = setHeartbeatInterval(() => {
      recordWorkerHeartbeat(db, config.guildId, nextIso());
    }, DISCORD_PRESENCE_HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (!heartbeatId) return;
    clearHeartbeatInterval(heartbeatId);
    heartbeatId = null;
  }

  async function start() {
    if (!config.configured) {
      logger.warn('[discord-worker] DISCORD_GUILD_ID or DISCORD_BOT_TOKEN is missing. Worker is idle.');
      return { configured: false, guildId: null, moduleKeys };
    }

    writeWorkerState(db, config.guildId, {
      runtimeStatus: 'idle',
      botInstallStatus: 'unknown',
      lastError: null,
      lastHeartbeatAt: nextIso(),
    }, nextIso());

    client = createClient(buildWorkerIntents(modules));
    startHeartbeat();
    await runAllModules('onStart');

    client.once('clientReady', async () => {
      logger.info(
        `[discord-worker] Logged in as ${client.user?.tag ?? 'unknown user'} with modules: ${moduleKeys.join(', ') || 'none'}.`,
      );
      await runAllModules('onReady');
    });

    client.on('guildCreate', (guild) => {
      void runAllModules('onGuildCreate', guild);
    });

    client.on('guildDelete', (guild) => {
      void runAllModules('onGuildDelete', guild);
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
      void runAllModules('onVoiceStateUpdate', oldState, newState);
    });

    client.on('guildMemberUpdate', (_oldMember, newMember) => {
      void runAllModules('onGuildMemberUpdate', _oldMember, newMember);
    });

    client.on('error', (error) => {
      recordAndLogWorkerError('[discord-worker] Client error.', error);
      void runAllModules('onError', error);
    });

    client.on('shardError', (error) => {
      recordAndLogWorkerError('[discord-worker] Shard error.', error);
      void runAllModules('onShardError', error);
    });

    client.on('invalidated', () => {
      recordWorkerError(db, config.guildId, 'Gateway session invalidated.', nextIso());
      logger.error('[discord-worker] Gateway session invalidated.');
      void runAllModules('onInvalidated');
    });

    try {
      await client.login(config.botToken);
    } catch (error) {
      recordAndLogWorkerError('[discord-worker] Startup error.', error);
      stopHeartbeat();
      throw error;
    }

    return { configured: true, guildId: config.guildId, moduleKeys };
  }

  async function stop() {
    if (stopped) return;
    stopped = true;

    stopHeartbeat();
    await runAllModules('onStop');

    if (config.configured && config.guildId) {
      writeWorkerState(db, config.guildId, {
        runtimeStatus: 'idle',
        lastHeartbeatAt: nextIso(),
      }, nextIso());
    }

    if (client) {
      await client.destroy();
      client = null;
    }

    if (!options.db) {
      db.close();
    }
  }

  return {
    config,
    db,
    moduleKeys,
    start,
    stop,
    runModule,
    getClient() {
      return client;
    },
  };
}

export function createDiscordPresenceWorker(options = {}) {
  const host = createDiscordWorkerHost({
    ...options,
    modules: options.modules ?? [createDiscordVoicePresenceModule()],
  });

  return {
    ...host,
    syncConfiguredGuild(reason = 'manual') {
      return host.runModule('voicePresence', 'syncConfiguredGuild', reason);
    },
  };
}
