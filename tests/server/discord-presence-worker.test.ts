import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, setupServerTestEnvironment } from './test-utils';
import { getDiscordPresenceWorkerSummary, listDiscordVoicePresence } from '@/lib/server/discord-presence';
import {
  applyVoiceStateUpdate,
  recordWorkerError,
  recordWorkerNotInstalled,
  syncGuildVoiceSnapshot,
} from '../../scripts/discord-presence-worker-lib.mjs';

function voiceState(channelId: string | null, overrides: Partial<{
  id: string;
  username: string;
  displayName: string;
  bot: boolean;
}> = {}) {
  const id = overrides.id ?? 'discord-1';
  const username = overrides.username ?? 'smirk';
  return {
    id,
    channelId,
    member: {
      id,
      displayName: overrides.displayName ?? 'Smirk',
      user: {
        id,
        username,
        bot: overrides.bot ?? false,
      },
    },
  };
}

describe('discord presence worker library', () => {
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

  it('hydrates the current voice snapshot and removes stale rows on the next sync', () => {
    syncGuildVoiceSnapshot(context.db, 'guild-1', [
      {
        discordId: 'discord-1',
        channelId: 'voice-1',
        username: 'smirk',
        displayName: 'Smirk',
      },
      {
        discordId: 'discord-2',
        channelId: 'voice-2',
        username: 'bronwen',
        displayName: 'Bronwen',
      },
      {
        discordId: 'discord-bot',
        channelId: 'voice-3',
        username: 'ghosted-bot',
        displayName: 'Ghosted Bot',
      },
    ], '2026-04-11T20:00:00.000Z');

    expect(listDiscordVoicePresence(context.db, 'guild-1').map((row) => row.discordId)).toEqual([
      'discord-1',
      'discord-2',
      'discord-bot',
    ]);

    syncGuildVoiceSnapshot(context.db, 'guild-1', [
      {
        discordId: 'discord-2',
        channelId: 'voice-2',
        username: 'bronwen',
        displayName: 'Bronwen',
      },
    ], '2026-04-11T20:00:10.000Z');

    expect(listDiscordVoicePresence(context.db, 'guild-1').map((row) => row.discordId)).toEqual([
      'discord-2',
    ]);
  });

  it('handles join, move, and leave updates while preserving and resetting joined timestamps appropriately', () => {
    applyVoiceStateUpdate(
      context.db,
      'guild-1',
      voiceState(null),
      voiceState('voice-1'),
      '2026-04-11T20:00:00.000Z',
    );

    let rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows[0]?.channelId).toBe('voice-1');
    expect(rows[0]?.joinedAt).toBe('2026-04-11T20:00:00.000Z');

    applyVoiceStateUpdate(
      context.db,
      'guild-1',
      voiceState('voice-1'),
      voiceState('voice-1', { displayName: 'Smirk Active' }),
      '2026-04-11T20:00:05.000Z',
    );

    rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows[0]?.displayName).toBe('Smirk Active');
    expect(rows[0]?.joinedAt).toBe('2026-04-11T20:00:00.000Z');

    applyVoiceStateUpdate(
      context.db,
      'guild-1',
      voiceState('voice-1', { displayName: 'Smirk Active' }),
      voiceState('voice-2', { displayName: 'Smirk Active' }),
      '2026-04-11T20:00:10.000Z',
    );

    rows = listDiscordVoicePresence(context.db, 'guild-1');
    expect(rows[0]?.channelId).toBe('voice-2');
    expect(rows[0]?.joinedAt).toBe('2026-04-11T20:00:10.000Z');

    applyVoiceStateUpdate(
      context.db,
      'guild-1',
      voiceState('voice-2', { displayName: 'Smirk Active' }),
      voiceState(null, { displayName: 'Smirk Active' }),
      '2026-04-11T20:00:15.000Z',
    );

    expect(listDiscordVoicePresence(context.db, 'guild-1')).toHaveLength(0);
  });

  it('records not-installed and error worker states for health reporting', () => {
    syncGuildVoiceSnapshot(context.db, 'guild-1', [
      {
        discordId: 'discord-1',
        channelId: 'voice-1',
        username: 'smirk',
        displayName: 'Smirk',
      },
    ], '2026-04-11T20:00:00.000Z');

    recordWorkerNotInstalled(
      context.db,
      'guild-1',
      'Bot is not installed in the configured guild.',
      '2026-04-11T20:00:05.000Z',
    );

    let summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.health).toBe('not-installed');
    expect(summary.state?.lastError).toContain('not installed');
    expect(listDiscordVoicePresence(context.db, 'guild-1')).toHaveLength(0);

    recordWorkerError(
      context.db,
      'guild-1',
      new Error('Gateway invalidated.'),
      '2026-04-11T20:00:10.000Z',
    );

    summary = getDiscordPresenceWorkerSummary(context.db, 'guild-1');
    expect(summary.health).toBe('error');
    expect(summary.state?.runtimeStatus).toBe('error');
    expect(summary.state?.lastError).toContain('Gateway invalidated');
  });
});
