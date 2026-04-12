import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { utcIso } from '@/lib/server/core';
import {
  replaceScenePresenceChannelAllowlist,
  upsertDiscordPresenceWorkerState,
} from '@/lib/server/discord-presence';

const { requireAdminUserMock } = vi.hoisted(() => ({
  requireAdminUserMock: vi.fn(),
}));

vi.mock('@/lib/server/ghosted-api', () => {
  return {
    displayName: (user: { global_name?: string | null; username: string }) => user.global_name || user.username,
    getBalance: vi.fn(() => 0),
    getCurrentUser: vi.fn(async () => null),
    getUserByDiscordId: vi.fn(() => undefined),
    getUserById: vi.fn(() => undefined),
    listGiveaways: vi.fn(async () => []),
    listNewsPosts: vi.fn(() => []),
    requireAdminUser: requireAdminUserMock,
  };
});

import {
  discordPresenceAdminPayload,
  saveDiscordPresenceAllowlist,
} from '@/lib/server/ghosted-admin';

function mockGuildChannels(channels: Array<{ id: string; name: string; type: number }>) {
  return vi.fn().mockImplementation(async () => new Response(JSON.stringify(channels), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('discord presence admin payloads', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({
      DISCORD_GUILD_ID: 'ghosted-guild',
      DISCORD_BOT_TOKEN: 'bot-token',
    });
    const adminUserId = insertUser(context.db, {
      discordId: 'admin-discord',
      username: 'admin',
      globalName: 'Admin User',
      isAdmin: 1,
    });
    requireAdminUserMock.mockReset();
    requireAdminUserMock.mockResolvedValue({
      id: adminUserId,
      discord_id: 'admin-discord',
      username: 'admin',
      global_name: 'Admin User',
      avatar_hash: null,
      roles_json: '[]',
      is_admin: 1,
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns worker status, active modules, and selected guild channels for the admin picker', async () => {
    const now = utcIso();
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: now,
      lastSyncAt: now,
      lastError: null,
    });
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'stage-1', channelName: 'Main Stage', channelType: 'stage' },
    ]);

    vi.stubGlobal('fetch', mockGuildChannels([
      { id: 'voice-1', name: 'Lounge', type: 2 },
      { id: 'stage-1', name: 'Main Stage', type: 13 },
      { id: 'text-1', name: 'general', type: 0 },
    ]));

    const payload = await discordPresenceAdminPayload();

    expect(payload.actor.displayName).toBe('Admin User');
    expect(payload.publicMode).toBe('bot');
    expect(payload.worker.health).toBe('healthy');
    expect(payload.worker.activeModules).toEqual([
      { key: 'voicePresence', label: 'Voice presence', enabled: true },
    ]);
    expect(payload.channels).toEqual([
      { id: 'stage-1', name: 'Main Stage', type: 'stage', selected: true },
      { id: 'voice-1', name: 'Lounge', type: 'voice', selected: false },
    ]);
    expect(payload.allowlist.map((entry) => entry.channelId)).toEqual(['stage-1']);
    expect(payload.channelFetchError).toBeNull();
  });

  it('saves the public allowlist from current Discord guild channels and returns updated picker state', async () => {
    const now = utcIso();
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: now,
      lastSyncAt: now,
      lastError: null,
    });

    vi.stubGlobal('fetch', mockGuildChannels([
      { id: 'voice-1', name: 'Lounge', type: 2 },
      { id: 'stage-1', name: 'Main Stage', type: 13 },
    ]));

    const request = new Request('http://localhost/api/admin/discord-presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelIds: ['voice-1'] }),
    });

    const payload = await saveDiscordPresenceAllowlist(request);

    expect(payload.allowlist).toHaveLength(1);
    expect(payload.allowlist[0]).toMatchObject({
      channelId: 'voice-1',
      channelName: 'Lounge',
      channelType: 'voice',
    });
    expect(payload.channels).toEqual([
      { id: 'stage-1', name: 'Main Stage', type: 'stage', selected: false },
      { id: 'voice-1', name: 'Lounge', type: 'voice', selected: true },
    ]);
  });
});
