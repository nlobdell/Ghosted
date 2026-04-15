import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import type { LootChestGameState } from '@/lib/types';
import {
  cleanupServerTestEnvironment,
  insertUser,
  setupServerTestEnvironment,
} from './test-utils';

const { authMock, cookiesMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { GET as getPlatformStateRoute } from '@/app/api/v/twitch/state/route';
import { GET as getAppStateRoute } from '@/app/api/v/state/route';
import { GET as getPlatformCallbackRoute } from '@/app/api/v/twitch/callback/route';
import { POST as postPlatformDisconnectRoute } from '@/app/api/v/twitch/disconnect/route';
import { POST as postPlatformEventSubRoute } from '@/app/api/v/twitch/eventsub/route';
import { GET as getGiveawayBuildRoute } from '@/app/api/v/giveaways/build/route';
import { GET as getGiveawayStateRoute } from '@/app/api/v/giveaways/state/route';
import { GET as getGiveawayCallbackRoute } from '@/app/api/v/giveaways/twitch/callback/route';
import { POST as postGiveawayPresentationRoute } from '@/app/api/v/giveaways/presentation/route';
import { POST as postGiveawayClearCacheRoute } from '@/app/api/v/giveaways/twitch/cache/clear/route';
import { POST as postStartTurnRoute } from '@/app/api/v/giveaways/turns/[id]/start/route';
import { POST as postSelectTurnRoute } from '@/app/api/v/giveaways/turns/[id]/select/route';
import { POST as postRevealTurnRoute } from '@/app/api/v/giveaways/turns/[id]/reveal/route';
import { POST as postCompleteTurnRoute } from '@/app/api/v/giveaways/turns/[id]/complete/route';
import { getUserById } from '@/lib/server/ghosted-api';
import { twitchPlatformStore } from '@/lib/server/twitch-platform';
import { completeGhostedTwitchPlatformConnect, beginGhostedTwitchPlatformConnect, replayGhostedTwitchDelivery } from '@/lib/server/twitch-platform-runtime';
import {
  insertQueuedLootChestTurnForTests,
  overlayTokenFromSettings,
  turnRowsForTests,
} from '@/lib/server/twitch-loot-chest';
import { utcIso } from '@/lib/server/core';

const GIVEAWAY_REDEMPTION_SUBSCRIPTION = 'channel.channel_points_custom_reward_redemption.add';

function twitchSignature(body: string, secret: string, messageId: string, timestamp: string) {
  return `sha256=${crypto.createHmac('sha256', secret).update(messageId + timestamp + body).digest('hex')}`;
}

function seedConnectedTwitchState(context: ServerTestContext, overrides: Partial<{
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterDisplayName: string;
  rewardId: string;
  subscriptionId: string;
  createSubscription: boolean;
}> = {}) {
  const broadcasterId = overrides.broadcasterId ?? 'broadcaster-1';
  const rewardId = overrides.rewardId ?? 'reward-1';
  const now = utcIso();

  overlayTokenFromSettings();
  twitchPlatformStore.upsertBroadcaster(context.db, {
    broadcasterUserId: broadcasterId,
    broadcasterLogin: overrides.broadcasterLogin ?? 'ghosted',
    broadcasterDisplayName: overrides.broadcasterDisplayName ?? 'Ghosted',
    accessToken: 'user-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: utcIso(new Date(Date.now() + 60 * 60 * 1000)),
    scopes: ['channel:manage:redemptions', 'channel:read:redemptions'],
    isActive: true,
  });

  context.db.prepare(`
    UPDATE twitch_loot_chest_settings
    SET broadcaster_user_id = ?,
        reward_id = ?,
        reward_title = ?,
        reward_prompt = ?,
        reward_cost = ?,
        reward_is_enabled = 1,
        reward_is_paused = 0,
        updated_at = ?
    WHERE singleton_key = 'default'
  `).run(
    broadcasterId,
    rewardId,
    'Loot Chest Spin',
    'Redeem for a host-run Ghosted loot chest turn.',
    1000,
    now,
  );

  if (overrides.createSubscription ?? true) {
    twitchPlatformStore.upsertSubscription(context.db, {
      id: overrides.subscriptionId ?? 'sub-1',
      moduleKey: 'giveaways',
      subscriptionType: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
      subscriptionVersion: '1',
      broadcasterUserId: broadcasterId,
      condition: {
        broadcaster_user_id: broadcasterId,
        reward_id: rewardId,
      },
      transportMethod: 'webhook',
      callbackUrl: 'https://ghostedclan.com/api/v/twitch/eventsub',
      status: 'enabled',
      lastVerifiedAt: now,
      lastSyncAttemptAt: now,
    });
  }
}

describe('twitch platform and loot chest routes', () => {
  let context: ServerTestContext;
  let operatorUserId: number;
  let outsiderUserId: number;

  beforeEach(() => {
    context = setupServerTestEnvironment({
      TWITCH_OPERATOR_DISCORD_IDS: 'operator-discord',
    });
    operatorUserId = insertUser(context.db, {
      discordId: 'operator-discord',
      username: 'operator',
      globalName: 'Operator User',
    });
    outsiderUserId = insertUser(context.db, {
      discordId: 'outsider-discord',
      username: 'outsider',
      globalName: 'Outsider User',
    });

    authMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a no-store build id for long-lived public overlay refresh checks', async () => {
    const response = await getGiveawayBuildRoute();
    const payload = await response.json() as { buildId?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(typeof payload.buildId).toBe('string');
    expect(payload.buildId?.length).toBeGreaterThan(0);
  });

  it('returns 401 for signed-out Twitch platform state requests', async () => {
    authMock.mockResolvedValue(null);

    const response = await getPlatformStateRoute();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('returns 403 for signed-in users outside the operator allowlist', async () => {
    authMock.mockResolvedValue({ user: { id: String(outsiderUserId) } });

    const response = await getPlatformStateRoute();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: 'You do not have access to the Twitch operator console.' });
  });

  it('returns the combined /v app-shell state for allowlisted operators', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    insertQueuedLootChestTurnForTests({ viewerLogin: 'shell_viewer', viewerDisplayName: 'Shell Viewer' });

    const response = await getAppStateRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.platform.connection.id).toBe('broadcaster-1');
    expect(payload.platform.modules).toHaveLength(1);
    expect(payload.giveaway.connection.connected).toBe(true);
    expect(payload.giveaway.queue).toHaveLength(1);
    expect(payload.giveaway.scene.queueCount).toBe(1);
  });

  it('preserves the Twitch platform callback query when redirecting signed-out users to login', async () => {
    authMock.mockResolvedValue(null);

    const response = await getPlatformCallbackRoute(new Request('http://0.0.0.0:3000/api/v/twitch/callback?code=test-code&state=test-state'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://ghostedclan.com/auth/login?next=%2Fapi%2Fv%2Ftwitch%2Fcallback%3Fcode%3Dtest-code%26state%3Dtest-state',
    );
  });

  it('preserves the giveaway callback query when redirecting signed-out users to login', async () => {
    authMock.mockResolvedValue(null);

    const response = await getGiveawayCallbackRoute(new Request('http://0.0.0.0:3000/api/v/giveaways/twitch/callback?code=test-code&state=test-state'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://ghostedclan.com/auth/login?next=%2Fapi%2Fv%2Fgiveaways%2Ftwitch%2Fcallback%3Fcode%3Dtest-code%26state%3Dtest-state',
    );
  });

  it('returns operator platform state, giveaway state, and overlay state for allowlisted users', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    insertQueuedLootChestTurnForTests({ viewerLogin: 'viewer_one', viewerDisplayName: 'Viewer One' });

    const platformResponse = await getPlatformStateRoute();
    const platformPayload = await platformResponse.json();

    expect(platformResponse.status).toBe(200);
    expect(platformPayload.operator.discordId).toBe('operator-discord');
    expect(platformPayload.connection.id).toBe('broadcaster-1');
    expect(platformPayload.modules).toHaveLength(1);
    expect(platformPayload.subscriptions).toHaveLength(1);

    const giveawayResponse = await getGiveawayStateRoute(new Request('http://localhost/api/v/giveaways/state'));
    const giveawayPayload = await giveawayResponse.json();

    expect(giveawayResponse.status).toBe(200);
    expect(giveawayPayload.connection.connected).toBe(true);
    expect(giveawayPayload.queue).toHaveLength(1);
    expect(giveawayPayload.scene.queueCount).toBe(1);
    expect(giveawayPayload.queue[0]).toMatchObject({
      phase: 'queued',
      lastAction: 'queued',
      resolutionCue: null,
    });

    const overlayToken = overlayTokenFromSettings();
    const overlayResponse = await getGiveawayStateRoute(new Request(`http://localhost/api/v/giveaways/state?overlayToken=${overlayToken}`));
    const overlayPayload = await overlayResponse.json();

    expect(overlayResponse.status).toBe(200);
    expect(overlayPayload.queueCount).toBe(1);
    expect(overlayPayload.connection.connected).toBe(true);
    expect(overlayPayload.scene.queueCount).toBe(1);
  });

  it('clears stale pending turns and restores unfulfilled Twitch redemptions from the source of truth', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    insertQueuedLootChestTurnForTests({
      redemptionId: 'stale-redemption',
      viewerLogin: 'stale_viewer',
      viewerDisplayName: 'Stale Viewer',
    });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/helix/channel_points/custom_rewards/redemptions')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'remote-redemption',
            user_id: 'viewer-remote',
            user_login: 'remote_login',
            user_name: 'Remote Viewer',
            redeemed_at: '2026-04-14T19:34:00.000Z',
            reward: {
              id: 'reward-1',
            },
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const response = await postGiveawayClearCacheRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.removedCount).toBe(1);
    expect(payload.importedCount).toBe(1);
    expect(payload.pendingCount).toBe(1);
    expect(payload.state.queue).toHaveLength(1);
    expect(payload.state.queue[0].redemptionId).toBe('remote-redemption');
    expect(turnRowsForTests()).toHaveLength(1);
    expect(turnRowsForTests()[0].redemption_id).toBe('remote-redemption');
  });

  it('disconnects Twitch and clears the managed giveaway session state', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    insertQueuedLootChestTurnForTests({
      redemptionId: 'queued-redemption',
      viewerLogin: 'queued_viewer',
      viewerDisplayName: 'Queued Viewer',
    });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://id.twitch.tv/oauth2/token') {
        return new Response(JSON.stringify({
          access_token: 'app-token',
          expires_in: 3600,
          token_type: 'bearer',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/helix/channel_points/custom_rewards') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({
          data: [{
            id: 'reward-1',
            title: 'Loot Chest Spin',
            prompt: 'Redeem for a host-run Ghosted loot chest turn.',
            cost: 1000,
            is_enabled: false,
            is_paused: true,
          }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/helix/eventsub/subscriptions') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const response = await postPlatformDisconnectRoute();
    const payload = await response.json() as {
      platformState: { connection: unknown; subscriptions: unknown[] };
      giveawayState: LootChestGameState;
    };

    expect(response.status).toBe(200);
    expect(payload.platformState.connection).toBeNull();
    expect(payload.platformState.subscriptions).toHaveLength(0);
    expect(payload.giveawayState.connection.connected).toBe(false);
    expect(payload.giveawayState.connection.broadcaster).toBeNull();
    expect(payload.giveawayState.connection.reward.id).toBeNull();
    expect(payload.giveawayState.queue).toHaveLength(0);
    expect(turnRowsForTests()).toHaveLength(0);
    expect(twitchPlatformStore.getActiveBroadcaster(context.db)).toBeUndefined();

    const settings = context.db.prepare(`
      SELECT reward_id, broadcaster_user_id, reward_is_enabled
      FROM twitch_loot_chest_settings
      WHERE singleton_key = 'default'
      LIMIT 1
    `).get() as {
      reward_id: string | null;
      broadcaster_user_id: string | null;
      reward_is_enabled: number;
    };

    expect(settings.reward_id).toBeNull();
    expect(settings.broadcaster_user_id).toBeNull();
    expect(settings.reward_is_enabled).toBe(0);
  });

  it('persists accepted webhook deliveries, creates queued turns, and ignores duplicate message ids', async () => {
    seedConnectedTwitchState(context);
    const body = JSON.stringify({
      subscription: {
        id: 'sub-1',
        status: 'enabled',
        type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
        version: '1',
        condition: {
          broadcaster_user_id: 'broadcaster-1',
          reward_id: 'reward-1',
        },
        transport: {
          callback: 'https://ghostedclan.com/api/v/twitch/eventsub',
        },
      },
      event: {
        id: 'redemption-1',
        user_id: 'viewer-1',
        user_login: 'viewer_login',
        user_name: 'Viewer Login',
        redeemed_at: '2026-04-14T19:30:00.000Z',
        reward: {
          id: 'reward-1',
        },
      },
    });
    const messageId = 'eventsub-message-1';
    const timestamp = '2026-04-14T19:30:00.000Z';
    const signature = twitchSignature(body, process.env.TWITCH_EVENTSUB_SECRET!, messageId, timestamp);

    const response = await postPlatformEventSubRoute(new Request('http://localhost/api/v/twitch/eventsub', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'Twitch-Eventsub-Message-Type': 'notification',
        'Twitch-Eventsub-Message-Id': messageId,
        'Twitch-Eventsub-Message-Timestamp': timestamp,
        'Twitch-Eventsub-Message-Signature': signature,
      },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(turnRowsForTests()).toHaveLength(1);

    const deliveryRow = context.db.prepare(`
      SELECT *
      FROM twitch_platform_deliveries
      WHERE message_id = ?
      LIMIT 1
    `).get(messageId) as { processing_status: string };
    expect(deliveryRow.processing_status).toBe('processed');

    const duplicateResponse = await postPlatformEventSubRoute(new Request('http://localhost/api/v/twitch/eventsub', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'Twitch-Eventsub-Message-Type': 'notification',
        'Twitch-Eventsub-Message-Id': messageId,
        'Twitch-Eventsub-Message-Timestamp': timestamp,
        'Twitch-Eventsub-Message-Signature': signature,
      },
    }));
    const duplicatePayload = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(200);
    expect(duplicatePayload.duplicate).toBe(true);
    expect(turnRowsForTests()).toHaveLength(1);
  });

  it('responds to webhook challenges and records the subscription state', async () => {
    seedConnectedTwitchState(context, { createSubscription: false });
    const body = JSON.stringify({
      challenge: 'challenge-token',
      subscription: {
        id: 'sub-2',
        status: 'webhook_callback_verification_pending',
        type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
        version: '1',
        condition: {
          broadcaster_user_id: 'broadcaster-1',
          reward_id: 'reward-1',
        },
        transport: {
          method: 'webhook',
          callback: 'https://ghostedclan.com/api/v/twitch/eventsub',
        },
      },
    });
    const messageId = 'eventsub-message-2';
    const timestamp = '2026-04-14T19:31:00.000Z';
    const signature = twitchSignature(body, process.env.TWITCH_EVENTSUB_SECRET!, messageId, timestamp);

    const response = await postPlatformEventSubRoute(new Request('http://localhost/api/v/twitch/eventsub', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'Twitch-Eventsub-Message-Type': 'webhook_callback_verification',
        'Twitch-Eventsub-Message-Id': messageId,
        'Twitch-Eventsub-Message-Timestamp': timestamp,
        'Twitch-Eventsub-Message-Signature': signature,
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('challenge-token');

    const subscription = twitchPlatformStore.listSubscriptions(context.db).find((entry) => entry.id === 'sub-2');
    expect(subscription?.status).toBe('webhook_callback_verification_pending');
  });

  it('marks failed delivery processing without losing the raw payload', async () => {
    seedConnectedTwitchState(context);
    const body = JSON.stringify({
      subscription: {
        id: 'sub-1',
        status: 'enabled',
        type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
        version: '1',
        condition: {
          broadcaster_user_id: 'broadcaster-1',
          reward_id: 'reward-1',
        },
        transport: {
          callback: 'https://ghostedclan.com/api/v/twitch/eventsub',
        },
      },
      event: {
        user_id: 'viewer-1',
        user_login: 'viewer_login',
        user_name: 'Viewer Login',
        reward: {
          id: 'reward-1',
        },
      },
    });
    const messageId = 'eventsub-message-failed';
    const timestamp = '2026-04-14T19:32:00.000Z';
    const signature = twitchSignature(body, process.env.TWITCH_EVENTSUB_SECRET!, messageId, timestamp);

    const response = await postPlatformEventSubRoute(new Request('http://localhost/api/v/twitch/eventsub', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'Twitch-Eventsub-Message-Type': 'notification',
        'Twitch-Eventsub-Message-Id': messageId,
        'Twitch-Eventsub-Message-Timestamp': timestamp,
        'Twitch-Eventsub-Message-Signature': signature,
      },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('incomplete');

    const deliveryRow = context.db.prepare(`
      SELECT *
      FROM twitch_platform_deliveries
      WHERE message_id = ?
      LIMIT 1
    `).get(messageId) as {
      processing_status: string;
      raw_body: string;
      last_error: string | null;
    };

    expect(deliveryRow.processing_status).toBe('failed');
    expect(deliveryRow.raw_body).toBe(body);
    expect(deliveryRow.last_error).toContain('incomplete');
  });

  it('can replay a stored delivery without the original HTTP request context', async () => {
    seedConnectedTwitchState(context);
    const body = JSON.stringify({
      subscription: {
        id: 'sub-1',
        status: 'enabled',
        type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
        version: '1',
        condition: {
          broadcaster_user_id: 'broadcaster-1',
          reward_id: 'reward-1',
        },
        transport: {
          callback: 'https://ghostedclan.com/api/v/twitch/eventsub',
        },
      },
      event: {
        id: 'redemption-replay',
        user_id: 'viewer-replay',
        user_login: 'replay_login',
        user_name: 'Replay Viewer',
        redeemed_at: '2026-04-14T19:33:00.000Z',
        reward: {
          id: 'reward-1',
        },
      },
    });

    twitchPlatformStore.recordDelivery(context.db, {
      messageId: 'delivery-replay-1',
      subscriptionId: 'sub-1',
      subscriptionType: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
      messageType: 'notification',
      broadcasterUserId: 'broadcaster-1',
      verified: true,
      rawHeaders: {},
      rawBody: body,
      payloadJson: body,
    });

    const response = await replayGhostedTwitchDelivery('delivery-replay-1');

    expect(response.status).toBe(200);
    expect(turnRowsForTests()).toHaveLength(1);

    const deliveryRow = context.db.prepare(`
      SELECT *
      FROM twitch_platform_deliveries
      WHERE message_id = ?
      LIMIT 1
    `).get('delivery-replay-1') as { processing_status: string };
    expect(deliveryRow.processing_status).toBe('processed');
  });

  it('starts, reveals, and completes a winning loot chest turn', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    const queuedTurn = insertQueuedLootChestTurnForTests({ viewerLogin: 'winner', viewerDisplayName: 'Winner Viewer' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const startResponse = await postStartTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const startPayload = await startResponse.json();

    expect(startResponse.status).toBe(200);
    expect(startPayload.result.status).toBe('active');
    expect(startPayload.result.phase).toBe('selection');
    expect(startPayload.result.lastAction).toBe('turn_started');
    expect(startPayload.result.board.boardRevision).toBe(1);
    expect(startPayload.scene.focusTurn.id).toBe(queuedTurn.id);
    context.db.prepare(`
      UPDATE twitch_loot_chest_turns
      SET prize_chest_index = ?
      WHERE id = ?
    `).run(4, queuedTurn.id);

    const selectResponse = await postSelectTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/select', {
      method: 'POST',
      body: JSON.stringify({ chests: [4, 1, 8] }),
      headers: { 'Content-Type': 'application/json' },
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const selectPayload = await selectResponse.json();
    expect(selectResponse.status).toBe(200);
    expect(selectPayload.result.phase).toBe('locked');
    expect(selectPayload.result.lastAction).toBe('chests_selected');
    expect(selectPayload.result.board.boardRevision).toBe(2);
    expect(selectPayload.result.board.chests[4].spriteState).toBe('locked');
    expect(selectPayload.scene.focusTurn.board.boardRevision).toBe(2);

    const firstRevealResponse = await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const firstRevealPayload = await firstRevealResponse.json();
    expect(firstRevealResponse.status).toBe(200);
    expect(firstRevealPayload.result.phase).toBe('revealing');
    expect(firstRevealPayload.result.lastAction).toBe('chest_revealed');
    expect(firstRevealPayload.result.board.boardRevision).toBe(3);
    expect(firstRevealPayload.result.board.lastChangedChestIndex).toBe(4);
    expect(firstRevealPayload.result.board.chests[4]).toMatchObject({
      revealCue: true,
      spriteState: 'prize',
      animationState: 'opening',
    });
    expect(firstRevealPayload.scene.focusTurn.board.boardRevision).toBe(3);

    const secondRevealResponse = await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const secondRevealPayload = await secondRevealResponse.json();
    expect(secondRevealResponse.status).toBe(200);
    expect(secondRevealPayload.result.board.boardRevision).toBe(4);

    const finalRevealResponse = await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const finalRevealPayload = await finalRevealResponse.json();

    expect(finalRevealResponse.status).toBe(200);
    expect(finalRevealPayload.result.result).toBe('win');
    expect(finalRevealPayload.result.phase).toBe('resolved');
    expect(finalRevealPayload.result.board.boardRevision).toBe(5);
    expect(finalRevealPayload.result.resolutionCue).toMatchObject({ result: 'win', highlightChestIndex: 4 });
    expect(finalRevealPayload.scene.focusTurn.result).toBe('win');

    const completeResponse = await postCompleteTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/complete', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const completePayload = await completeResponse.json();

    expect(completeResponse.status).toBe(200);
    expect(completePayload.result.status).toBe('completed');
    expect(completePayload.result.result).toBe('win');
    expect(completePayload.result.lastAction).toBe('turn_completed');
    expect(completePayload.result.phase).toBe('resolved');
    expect(completePayload.result.board.boardRevision).toBe(6);
    expect(completePayload.result.board.lastChangedChestIndex).toBe(4);
    expect(completePayload.result.board.chests[4].spriteState).toBe('resolved-prize');
    expect(completePayload.scene.focusTurn.status).toBe('completed');
  });

  it('reveals a specifically clicked locked chest when the host sends a chest index', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    const queuedTurn = insertQueuedLootChestTurnForTests({ viewerLogin: 'picker', viewerDisplayName: 'Picker Viewer' });

    await postStartTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });

    context.db.prepare(`
      UPDATE twitch_loot_chest_turns
      SET prize_chest_index = ?
      WHERE id = ?
    `).run(4, queuedTurn.id);

    await postSelectTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/select', {
      method: 'POST',
      body: JSON.stringify({ chests: [4, 1, 8] }),
      headers: { 'Content-Type': 'application/json' },
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });

    const revealResponse = await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', {
      method: 'POST',
      body: JSON.stringify({ chestIndex: 8 }),
      headers: { 'Content-Type': 'application/json' },
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const revealPayload = await revealResponse.json();

    expect(revealResponse.status).toBe(200);
    expect(revealPayload.result.board.lastChangedChestIndex).toBe(8);
    expect(revealPayload.result.result).toBe('pending');
    expect(revealPayload.result.board.chests[8]).toMatchObject({
      revealCue: true,
      spriteState: 'empty',
      animationState: 'opening',
    });
  });

  it('publishes authenticated host hover presentation cues without mutating board state', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    const queuedTurn = insertQueuedLootChestTurnForTests({ viewerLogin: 'hoverer', viewerDisplayName: 'Hover Viewer' });

    await postStartTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });

    const response = await postGiveawayPresentationRoute(new Request('http://localhost/api/v/giveaways/presentation', {
      method: 'POST',
      body: JSON.stringify({ turnId: queuedTurn.id, chestIndex: 4 }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cue).toMatchObject({
      kind: 'hover',
      turnId: queuedTurn.id,
      chestIndex: 4,
    });

    const turnRow = turnRowsForTests()[0];
    expect(turnRow.selected_chests_json).toBe('[]');
    expect(turnRow.revealed_chests_json).toBe('[]');
  });

  it('publishes hover cues with mirrored draft selections so the public overlay can match the host scene', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    const queuedTurn = insertQueuedLootChestTurnForTests({ viewerLogin: 'hoverdraft', viewerDisplayName: 'Hover Draft Viewer' });

    await postStartTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });

    const response = await postGiveawayPresentationRoute(new Request('http://localhost/api/v/giveaways/presentation', {
      method: 'POST',
      body: JSON.stringify({ turnId: queuedTurn.id, chestIndex: 4, selectedChests: [1, 4, 8] }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cue).toMatchObject({
      kind: 'hover',
      turnId: queuedTurn.id,
      chestIndex: 4,
      selectedChests: [1, 4, 8],
    });

    const turnRow = turnRowsForTests()[0];
    expect(turnRow.selected_chests_json).toBe('[]');
    expect(turnRow.revealed_chests_json).toBe('[]');
  });

  it('publishes mirrored draft selection cues for the public overlay without mutating board state', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    seedConnectedTwitchState(context);
    const queuedTurn = insertQueuedLootChestTurnForTests({ viewerLogin: 'selector', viewerDisplayName: 'Selection Viewer' });

    await postStartTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/start', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });

    const response = await postGiveawayPresentationRoute(new Request('http://localhost/api/v/giveaways/presentation', {
      method: 'POST',
      body: JSON.stringify({ turnId: queuedTurn.id, selectedChests: [1, 4, 8] }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cue).toMatchObject({
      kind: 'selection',
      turnId: queuedTurn.id,
      selectedChests: [1, 4, 8],
    });

    const turnRow = turnRowsForTests()[0];
    expect(turnRow.selected_chests_json).toBe('[]');
    expect(turnRow.revealed_chests_json).toBe('[]');
  });

  it('stores broadcaster tokens and syncs the managed reward and subscription during connect completion', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    const actor = getUserById(context.db, operatorUserId);
    expect(actor).toBeTruthy();

    await beginGhostedTwitchPlatformConnect(actor!, '/v?tab=setup');
    const { oauth_state: state } = context.db.prepare(`
      SELECT oauth_state
      FROM twitch_platform_settings
      WHERE singleton_key = 'default'
    `).get() as { oauth_state: string | null };

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const rawBody = typeof init?.body === 'string' ? init.body : '';

      if (url.includes('id.twitch.tv/oauth2/token') && rawBody.includes('grant_type=authorization_code')) {
        return new Response(JSON.stringify({
          access_token: 'user-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: ['channel:manage:redemptions', 'channel:read:redemptions'],
          token_type: 'bearer',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('id.twitch.tv/oauth2/token') && rawBody.includes('grant_type=client_credentials')) {
        return new Response(JSON.stringify({
          access_token: 'app-token',
          expires_in: 3600,
          token_type: 'bearer',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/helix/users')) {
        return new Response(JSON.stringify({
          data: [{ id: 'broadcaster-1', login: 'ghosted', display_name: 'Ghosted' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/helix/channel_points/custom_rewards?') && url.includes('only_manageable_rewards=true')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/helix/channel_points/custom_rewards') && !url.includes('/redemptions')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'reward-1',
            title: 'Loot Chest Spin',
            prompt: 'Redeem for a host-run Ghosted loot chest turn.',
            cost: 1000,
            is_enabled: true,
            is_paused: false,
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/helix/eventsub/subscriptions') && url.includes(`type=${encodeURIComponent(GIVEAWAY_REDEMPTION_SUBSCRIPTION)}`)) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/helix/eventsub/subscriptions')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'sub-1',
            status: 'webhook_callback_verification_pending',
            type: GIVEAWAY_REDEMPTION_SUBSCRIPTION,
            version: '1',
            condition: { broadcaster_user_id: 'broadcaster-1', reward_id: 'reward-1' },
            transport: { callback: 'https://ghostedclan.com/api/v/twitch/eventsub' },
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const result = await completeGhostedTwitchPlatformConnect({
      code: 'oauth-code',
      state,
      actor: actor!,
    });

    expect(result.platformState.connection?.id).toBe('broadcaster-1');
    expect(result.platformState.subscriptions[0]?.id).toBe('sub-1');
    expect(result.giveawayState.connection.reward.id).toBe('reward-1');
    expect(result.giveawayState.connection.eventSub.subscriptionId).toBe('sub-1');
  });
});
