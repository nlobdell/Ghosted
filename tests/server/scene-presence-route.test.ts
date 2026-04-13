import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GHOSTLING_ACTOR_METRICS } from '@/lib/ghostling-actor';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';

const { buildRuntimeAuthConfigMock, womGroupIdMock, womRequestJsonMock } = vi.hoisted(() => ({
  buildRuntimeAuthConfigMock: vi.fn(),
  womGroupIdMock: vi.fn(),
  womRequestJsonMock: vi.fn(),
}));

vi.mock('@/lib/server/discord', () => ({
  buildRuntimeAuthConfig: buildRuntimeAuthConfigMock,
}));

vi.mock('@/lib/server/wom', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/wom')>('@/lib/server/wom');
  return {
    ...actual,
    womGroupId: womGroupIdMock,
    womRequestJson: womRequestJsonMock,
  };
});

import { GET, resetPresencePayloadCacheForTests } from '@/app/api/scene/presence/route';
import {
  replaceScenePresenceChannelAllowlist,
  upsertDiscordPresenceWorkerState,
  upsertDiscordVoicePresence,
} from '@/lib/server/discord-presence';
import { saveUserGameAccount } from '@/lib/server/wom';

function mockVoiceWidget(members: Array<{
  username: string;
  channel_id: string;
  display_name?: string;
  global_name?: string;
}>) {
  return vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    channels: [{ id: 'voice-1' }],
    members,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('scene presence route', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
    context = setupServerTestEnvironment();
    buildRuntimeAuthConfigMock.mockReset();
    womGroupIdMock.mockReset();
    womRequestJsonMock.mockReset();
    resetPresencePayloadCacheForTests();
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('includes stable keys, activity metadata, and Ghostling previews for widget-backed Discord voice members', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([{
      username: 'member',
      channel_id: 'voice-1',
      display_name: 'Member',
    }]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('voice');
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]?.key).toBe(`user:${userId}`);
    expect(payload.members[0]?.displayName).toBe('Member');
    expect(payload.members[0]?.source).toBe('voice');
    expect(payload.members[0]?.voiceSource).toBe('widget');
    expect(payload.members[0]?.activity.strength).toBe('high');
    expect(payload.members[0]?.activity.freshness).toBe('new');
    expect(payload.members[0]?.companion?.user).toEqual({ displayName: 'Member', username: 'member' });
    expect(payload.members[0]?.companion?.renderManifest.motion.accents.length).toBeGreaterThan(0);
    expect(payload.sharedScene?.hero?.variant).toBe('hero');
    expect(payload.sharedScene?.hero?.entities[0]?.key).toBe(`user:${userId}`);
  });

  it('includes the base companion preview for unmatched widget-backed Discord voice members', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([{
      username: 'wanderer',
      channel_id: 'voice-1',
      display_name: 'Wanderer',
    }]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'voice:wanderer',
      userId: null,
      username: 'wanderer',
      displayName: 'Wanderer',
      source: 'voice',
      voiceSource: 'widget',
    });
    expect(payload.members[0]?.companion?.user).toBeNull();
    expect(payload.members[0]?.companion?.animatedRenderUrl).toBe('/api/companion/render-animated');
    expect(payload.members[0]?.companion?.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-body.png'))).toBe(true);
  });

  it('combines Discord voice and WOM activity with per-member source metadata', async () => {
    insertUser(context.db, { username: 'member', globalName: 'Member' });
    const womUserId = insertUser(context.db, { username: 'player-one', globalName: 'Player One' });
    saveUserGameAccount(context.db, womUserId, 'osrs', {
      id: 123,
      username: 'Player One',
      displayName: 'Player One',
      status: 'active',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue('123');
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'Player One' } },
    ]);
    vi.stubGlobal('fetch', mockVoiceWidget([{
      username: 'member',
      channel_id: 'voice-1',
      display_name: 'Member',
    }]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('voice');
    expect(payload.members).toHaveLength(2);
    expect(payload.members.map((member: { source: string }) => member.source)).toEqual(['voice', 'wom']);
    expect(payload.members[0]?.voiceSource).toBe('widget');
    expect(payload.members[1]?.activity.strength).toBe('medium');
    expect(payload.members[1]?.companion?.animatedRenderUrl).toContain(`user=${womUserId}`);
  });

  it('prefers healthy worker voice rows joined by discord_id and only appends widget-only fallback extras', async () => {
    const linkedUserId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Member',
    });
    insertUser(context.db, {
      username: 'wanderer',
      globalName: 'Wanderer Local',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue(null);
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);

    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Captain Smirk',
      username: 'member',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });

    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'member', channel_id: 'voice-1', display_name: 'Captain Smirk' },
      { username: 'wanderer', channel_id: 'voice-1', display_name: 'Wanderer' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('voice');
    expect(payload.members).toHaveLength(2);
    expect(payload.members[0]).toMatchObject({
      key: `user:${linkedUserId}`,
      userId: linkedUserId,
      username: 'member',
      displayName: 'Captain Smirk',
      source: 'voice',
      voiceSource: 'bot',
    });
    expect(payload.members[0]?.companion?.user).toEqual({
      displayName: 'Member',
      username: 'member',
    });
    expect(payload.members[1]).toMatchObject({
      key: 'voice:wanderer',
      userId: null,
      username: 'wanderer',
      displayName: 'Wanderer',
      source: 'voice',
      voiceSource: 'widget',
    });
    expect(payload.members[1]?.companion?.user).toBeNull();
    expect(payload.members[1]?.companion?.animatedRenderUrl).toBe('/api/companion/render-animated');
  });

  it('filters bot-backed voice rows by the public allowlist while still permitting allowlisted widget fallback extras', async () => {
    const linkedUserId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Member',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue(null);
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);

    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-2',
      displayName: 'Captain Smirk',
      username: 'member',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });

    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'member', channel_id: 'voice-2', display_name: 'Captain Smirk' },
      { username: 'wanderer', channel_id: 'voice-1', display_name: 'Wanderer' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'voice:wanderer',
      username: 'wanderer',
      displayName: 'Wanderer',
      voiceSource: 'widget',
    });
    expect(payload.members[0]?.userId).toBeNull();
    expect(payload.members[0]?.companion?.user).toBeNull();
    expect(payload.members[0]?.key).not.toBe(`user:${linkedUserId}`);
  });

  it('includes the base companion preview for unmatched WOM members', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue('123');
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'Unlinked Player' } },
    ]);
    vi.stubGlobal('fetch', mockVoiceWidget([]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('wom');
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'wom:unlinked player',
      userId: null,
      username: 'Unlinked Player',
      displayName: 'Unlinked Player',
      source: 'wom',
    });
    expect(payload.members[0]?.companion?.user).toBeNull();
    expect(payload.members[0]?.companion?.animatedRenderUrl).toBe('/api/companion/render-animated');
  });

  it('dedupes cross-source members that resolve to the same username and keeps the stronger voice-linked entry', async () => {
    const linkedUserId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Member',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue('123');
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'member' } },
    ]);
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Captain Smirk',
      username: 'member',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });
    vi.stubGlobal('fetch', mockVoiceWidget([]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: `user:${linkedUserId}`,
      userId: linkedUserId,
      username: 'member',
      displayName: 'Captain Smirk',
      source: 'voice',
      voiceSource: 'bot',
    });
    expect(payload.members[0]?.companion?.user).toEqual({
      displayName: 'Member',
      username: 'member',
    });
  });

  it('dedupes bot and widget voice entries when the widget uses the same display name instead of the bot username', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue(null);
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'GhostedSmirk',
      username: 'cptsmirk',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });

    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'GhostedSmirk', channel_id: 'voice-1', display_name: 'GhostedSmirk' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'voice:cptsmirk',
      username: 'cptsmirk',
      displayName: 'GhostedSmirk',
      source: 'voice',
      voiceSource: 'bot',
    });
  });

  it('dedupes bot and widget voice entries when the nickname only differs by spacing or punctuation', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue(null);
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Ghosted Smirk',
      username: 'cptsmirk',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });

    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'GhostedSmirk', channel_id: 'voice-1', display_name: 'Ghosted Smirk' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'voice:cptsmirk',
      username: 'cptsmirk',
      displayName: 'Ghosted Smirk',
      source: 'voice',
      voiceSource: 'bot',
    });
  });

  it('keeps unrelated same-display-name voice members separate when usernames differ', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'alpha', channel_id: 'voice-1', display_name: 'Shared Name' },
      { username: 'beta', channel_id: 'voice-1', display_name: 'Shared Name' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(2);
    expect(payload.members.map((member: { key: string }) => member.key)).toEqual([
      'voice:alpha',
      'voice:beta',
    ]);
  });

  it('does not merge WOM and voice members by display name alone', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue('123');
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'Shared Name' } },
    ]);
    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'alpha', channel_id: 'voice-1', display_name: 'Shared Name' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(2);
    expect(payload.members.map((member: { key: string }) => member.key)).toEqual([
      'voice:alpha',
      'wom:shared name',
    ]);
  });

  it('dedupes WOM and bot voice members when the WOM name matches the bot nickname alias', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue('123');
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Ghosted Kami',
      username: 'justromeplz',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'Ghosted Kami' } },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: 'voice:justromeplz',
      username: 'justromeplz',
      displayName: 'Ghosted Kami',
      source: 'voice',
      voiceSource: 'bot',
    });
  });

  it('dedupes WOM and voice members when a linked voice user corroborates the WOM display name', async () => {
    const linkedUserId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'kami',
      globalName: 'Ghosted Kami',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue('123');
    replaceScenePresenceChannelAllowlist(context.db, 'ghosted-guild', [
      { channelId: 'voice-1', channelName: 'Lounge', channelType: 'voice' },
    ]);
    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:59:58.000Z',
      lastSyncAt: '2026-04-10T11:59:58.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Ghosted Kami',
      username: 'kami-alt',
      joinedAt: '2026-04-10T11:59:55.000Z',
      lastSeenAt: '2026-04-10T11:59:58.000Z',
    });
    womRequestJsonMock.mockResolvedValue([
      { player: { displayName: 'Ghosted Kami' } },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: `user:${linkedUserId}`,
      userId: linkedUserId,
      username: 'kami-alt',
      displayName: 'Ghosted Kami',
      source: 'voice',
      voiceSource: 'bot',
    });
  });

  it('rehomes persisted shared-scene entities back onto canonical hero points after a restart', async () => {
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'alpha', channel_id: 'voice-1', display_name: 'Alpha' },
    ]));

    context.db.prepare(`
      INSERT INTO scene_shared_snapshots (
        scene_key,
        version,
        variant,
        width,
        height,
        saved_at,
        payload_source,
        live_count,
        entities_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'hero:shared-commons',
      1,
      'hero',
      3150,
      350,
      Date.now(),
      'voice',
      1,
      JSON.stringify([{
        key: 'voice:alpha',
        x: 1575,
        y: 198,
        targetX: 1575,
        targetY: 198,
        speed: 18,
        velocityX: 0,
        velocityY: 0,
        pauseRemainingMs: 0,
        phaseRemainingMs: 0,
        targetSerial: 0,
        safeZoneKey: 'fallback-anchor',
        pointKey: 'fallback-anchor',
        scaleTier: 3,
        renderScale: 3,
        movementPhase: 'travel',
        facingLeft: false,
        opacity: 1,
        jammedMs: 0,
        fallback: false,
        source: 'voice',
        activeUntilTs: 0,
        lastSeenSignature: 'persisted:test',
        actorMetrics: DEFAULT_GHOSTLING_ACTOR_METRICS,
      }]),
      new Date().toISOString(),
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sharedScene?.hero?.entities).toHaveLength(1);
    expect(payload.sharedScene?.hero?.entities[0]).toMatchObject({
      key: 'voice:alpha',
      safeZoneKey: 'shared-floor',
      pointKey: 'floor-mid-left',
      scaleTier: 2,
      renderScale: 2,
    });
  });

  it('falls back to widget matching when the worker state is stale', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Member',
    });

    buildRuntimeAuthConfigMock.mockReturnValue({
      guildId: 'ghosted-guild',
      botToken: 'bot-token',
    });
    womGroupIdMock.mockReturnValue(null);

    upsertDiscordPresenceWorkerState(context.db, {
      guildId: 'ghosted-guild',
      runtimeStatus: 'running',
      botInstallStatus: 'installed',
      lastHeartbeatAt: '2026-04-10T11:58:00.000Z',
      lastSyncAt: '2026-04-10T11:58:00.000Z',
      lastError: null,
    });
    upsertDiscordVoicePresence(context.db, {
      guildId: 'ghosted-guild',
      discordId: 'discord-1',
      channelId: 'voice-1',
      displayName: 'Captain Smirk',
      username: 'member',
      joinedAt: '2026-04-10T11:57:55.000Z',
      lastSeenAt: '2026-04-10T11:58:00.000Z',
    });

    vi.stubGlobal('fetch', mockVoiceWidget([
      { username: 'member', channel_id: 'voice-1', display_name: 'Widget Member' },
    ]));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]).toMatchObject({
      key: `user:${userId}`,
      userId,
      username: 'member',
      displayName: 'Widget Member',
      voiceSource: 'widget',
    });
    expect(payload.members[0]?.companion?.user).toEqual({
      displayName: 'Member',
      username: 'member',
    });
  });

  it('preserves first-seen timestamps across cache windows and settles freshness after the new-member window', async () => {
    insertUser(context.db, { username: 'member', globalName: 'Member' });
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([{ username: 'member', channel_id: 'voice-1' }]));

    const firstResponse = await GET();
    const firstPayload = await firstResponse.json();
    const firstSeenAt = firstPayload.members[0]?.activity.firstSeenAt;
    const cachedLastSeenAt = firstPayload.members[0]?.activity.lastSeenAt;

    vi.setSystemTime(new Date('2026-04-10T12:00:10.000Z'));
    const cachedResponse = await GET();
    const cachedPayload = await cachedResponse.json();
    expect(cachedPayload.members[0]?.activity.firstSeenAt).toBe(firstSeenAt);
    expect(cachedPayload.members[0]?.activity.lastSeenAt).toBe(cachedLastSeenAt);

    vi.setSystemTime(new Date('2026-04-10T12:00:16.000Z'));
    const refreshedResponse = await GET();
    const refreshedPayload = await refreshedResponse.json();
    expect(refreshedPayload.members[0]?.activity.firstSeenAt).toBe(firstSeenAt);
    expect(refreshedPayload.members[0]?.activity.lastSeenAt).toBe(cachedLastSeenAt);
    expect(refreshedPayload.members[0]?.activity.freshness).toBe('new');

    await Promise.resolve();
    await Promise.resolve();

    const refreshedSettledResponse = await GET();
    const refreshedSettledPayload = await refreshedSettledResponse.json();
    expect(refreshedSettledPayload.members[0]?.activity.firstSeenAt).toBe(firstSeenAt);
    expect(refreshedSettledPayload.members[0]?.activity.lastSeenAt).not.toBe(cachedLastSeenAt);
    expect(refreshedSettledPayload.members[0]?.activity.freshness).toBe('new');

    vi.setSystemTime(new Date('2026-04-10T12:00:40.000Z'));
    const steadyRefreshResponse = await GET();
    await steadyRefreshResponse.json();

    await Promise.resolve();
    await Promise.resolve();

    const steadyResponse = await GET();
    const steadyPayload = await steadyResponse.json();
    expect(steadyPayload.members[0]?.activity.firstSeenAt).toBe(firstSeenAt);
    expect(steadyPayload.members[0]?.activity.freshness).toBe('steady');
  });

  it('advances the shared hero scene between requests even while presence members are cache-stable', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([{ username: 'member', channel_id: 'voice-1' }]));

    const firstResponse = await GET();
    const firstPayload = await firstResponse.json();
    const firstEntity = firstPayload.sharedScene?.hero?.entities.find((entity: { key: string }) => entity.key === `user:${userId}`);

    vi.setSystemTime(new Date('2026-04-10T12:00:05.000Z'));
    const secondResponse = await GET();
    const secondPayload = await secondResponse.json();
    const secondEntity = secondPayload.sharedScene?.hero?.entities.find((entity: { key: string }) => entity.key === `user:${userId}`);

    expect(firstPayload.members[0]?.key).toBe(`user:${userId}`);
    expect(secondPayload.members[0]?.key).toBe(`user:${userId}`);
    expect(secondEntity?.x).not.toBe(firstEntity?.x);
    expect(secondEntity?.y).not.toBe(firstEntity?.y);
    expect(secondPayload.sharedScene?.hero?.savedAt).toBeGreaterThan(firstPayload.sharedScene?.hero?.savedAt ?? 0);
  });

  it('persists the shared hero scene across in-memory runtime resets', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    buildRuntimeAuthConfigMock.mockReturnValue({ guildId: 'ghosted-guild' });
    womGroupIdMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockVoiceWidget([{ username: 'member', channel_id: 'voice-1' }]));

    const firstResponse = await GET();
    const firstPayload = await firstResponse.json();
    const firstEntity = firstPayload.sharedScene?.hero?.entities.find((entity: { key: string }) => entity.key === `user:${userId}`);

    resetPresencePayloadCacheForTests();
    vi.setSystemTime(new Date('2026-04-10T12:00:05.000Z'));

    const secondResponse = await GET();
    const secondPayload = await secondResponse.json();
    const secondEntity = secondPayload.sharedScene?.hero?.entities.find((entity: { key: string }) => entity.key === `user:${userId}`);

    expect(firstEntity?.x).toBeDefined();
    expect(secondEntity?.x).toBeDefined();
    expect(secondEntity?.x).not.toBe(firstEntity?.x);
    expect(secondEntity?.y).not.toBe(firstEntity?.y);
    expect(secondPayload.sharedScene?.hero?.savedAt).toBeGreaterThan(firstPayload.sharedScene?.hero?.savedAt ?? 0);
  });
});
