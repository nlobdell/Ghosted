import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, setupServerTestEnvironment } from './test-utils';
import {
  getDiscordPresenceWorkerState,
  getDiscordVoicePresence,
  listDiscordVoicePresence,
  listScenePresenceChannelAllowlist,
  replaceScenePresenceChannelAllowlist,
  resolveDiscordPresenceWorkerHealth,
  upsertDiscordPresenceWorkerState,
  upsertDiscordVoicePresence,
} from '@/lib/server/discord-presence';

describe('discord presence foundation', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({
      DISCORD_GUILD_ID: 'guild-1',
      DISCORD_BOT_TOKEN: 'bot-token',
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
  });

  it('creates the foundation tables and persists voice rows, allowlist rows, and worker state', () => {
    const tableNames = [
      'discord_voice_presence',
      'scene_presence_channel_allowlist',
      'discord_presence_worker_state',
    ];

    for (const tableName of tableNames) {
      const table = context.db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `).get(tableName) as { name: string } | undefined;
      expect(table?.name).toBe(tableName);
    }

    const allowlist = replaceScenePresenceChannelAllowlist(context.db, 'guild-1', [
      { channelId: 'voice-1', channelName: 'General', channelType: 'voice' },
      { channelId: 'stage-1', channelName: 'Stage', channelType: 'stage' },
    ]);
    expect(allowlist).toHaveLength(2);
    expect(listScenePresenceChannelAllowlist(context.db, 'guild-1').map((entry) => entry.channelId)).toEqual([
      'voice-1',
      'stage-1',
    ]);

    const firstPresence = upsertDiscordVoicePresence(context.db, {
      guildId: 'guild-1',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Smirk',
      username: 'smirk',
      joinedAt: '2026-04-11T20:00:00.000Z',
      lastSeenAt: '2026-04-11T20:00:05.000Z',
    });
    expect(firstPresence?.channelId).toBe('voice-1');

    const updatedPresence = upsertDiscordVoicePresence(context.db, {
      guildId: 'guild-1',
      discordId: 'discord-1',
      channelId: 'stage-1',
      displayName: 'Smirk Live',
      username: 'smirk',
      joinedAt: '2026-04-11T20:00:00.000Z',
      lastSeenAt: '2026-04-11T20:00:10.000Z',
    });
    expect(updatedPresence?.channelId).toBe('stage-1');
    expect(updatedPresence?.displayName).toBe('Smirk Live');
    expect(listDiscordVoicePresence(context.db, 'guild-1')).toHaveLength(1);
    expect(getDiscordVoicePresence(context.db, 'guild-1', 'discord-1')?.lastSeenAt).toBe('2026-04-11T20:00:10.000Z');

    const workerState = upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'guild-1',
      runtimeStatus: 'idle',
      botInstallStatus: 'unknown',
      lastError: 'Scaffold worker only.',
    });
    expect(workerState?.runtimeStatus).toBe('idle');
    expect(getDiscordPresenceWorkerState(context.db, 'guild-1')?.lastError).toBe('Scaffold worker only.');
  });

  it('replaces the allowlist instead of appending stale channel rows', () => {
    replaceScenePresenceChannelAllowlist(context.db, 'guild-1', [
      { channelId: 'voice-1', channelName: 'General', channelType: 'voice' },
      { channelId: 'stage-1', channelName: 'Stage', channelType: 'stage' },
    ]);

    const replaced = replaceScenePresenceChannelAllowlist(context.db, 'guild-1', [
      { channelId: 'voice-2', channelName: 'Raids', channelType: 'voice' },
    ]);

    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.channelId).toBe('voice-2');
  });

  it('classifies worker health from configuration, install state, runtime state, and heartbeat freshness', () => {
    expect(resolveDiscordPresenceWorkerHealth(null, { configured: false })).toBe('not-configured');
    expect(resolveDiscordPresenceWorkerHealth(null, { configured: true })).toBe('idle');

    expect(resolveDiscordPresenceWorkerHealth({
      guildId: 'guild-1',
      runtimeStatus: 'running',
      botInstallStatus: 'unknown',
      lastHeartbeatAt: null,
      lastSyncAt: null,
      lastError: null,
      updatedAt: '2026-04-11T20:00:00.000Z',
    }, {
      configured: true,
      nowMs: Date.parse('2026-04-11T20:00:30.000Z'),
      staleAfterMs: 45_000,
    })).toBe('stale');

    expect(resolveDiscordPresenceWorkerHealth({
      guildId: 'guild-1',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-11T20:00:00.000Z',
      lastSyncAt: '2026-04-11T20:00:00.000Z',
      lastError: null,
      updatedAt: '2026-04-11T20:00:00.000Z',
    }, {
      configured: true,
      nowMs: Date.parse('2026-04-11T20:00:30.000Z'),
      staleAfterMs: 45_000,
    })).toBe('healthy');

    expect(resolveDiscordPresenceWorkerHealth({
      guildId: 'guild-1',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-11T20:00:00.000Z',
      lastSyncAt: '2026-04-11T20:00:00.000Z',
      lastError: null,
      updatedAt: '2026-04-11T20:00:00.000Z',
    }, {
      configured: true,
      nowMs: Date.parse('2026-04-11T20:01:00.000Z'),
      staleAfterMs: 45_000,
    })).toBe('stale');

    expect(resolveDiscordPresenceWorkerHealth({
      guildId: 'guild-1',
      runtimeStatus: 'error',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-11T20:00:00.000Z',
      lastSyncAt: '2026-04-11T20:00:00.000Z',
      lastError: 'Gateway disconnected.',
      updatedAt: '2026-04-11T20:00:00.000Z',
    }, { configured: true })).toBe('error');

    expect(resolveDiscordPresenceWorkerHealth({
      guildId: 'guild-1',
      runtimeStatus: 'running',
      botInstallStatus: 'not-installed',
      lastHeartbeatAt: '2026-04-11T20:00:00.000Z',
      lastSyncAt: null,
      lastError: null,
      updatedAt: '2026-04-11T20:00:00.000Z',
    }, { configured: true })).toBe('not-installed');
  });
});
