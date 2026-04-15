import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
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
import { GET as getPlatformCallbackRoute } from '@/app/api/v/twitch/callback/route';
import { POST as postPlatformEventSubRoute } from '@/app/api/v/twitch/eventsub/route';
import { GET as getGiveawayStateRoute } from '@/app/api/v/giveaways/state/route';
import { GET as getGiveawayCallbackRoute } from '@/app/api/v/giveaways/twitch/callback/route';
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

  it('preserves the Twitch platform callback query when redirecting signed-out users to login', async () => {
    authMock.mockResolvedValue(null);

    const response = await getPlatformCallbackRoute(new Request('http://localhost/api/v/twitch/callback?code=test-code&state=test-state'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?next=%2Fapi%2Fv%2Ftwitch%2Fcallback%3Fcode%3Dtest-code%26state%3Dtest-state',
    );
  });

  it('preserves the giveaway callback query when redirecting signed-out users to login', async () => {
    authMock.mockResolvedValue(null);

    const response = await getGiveawayCallbackRoute(new Request('http://localhost/api/v/giveaways/twitch/callback?code=test-code&state=test-state'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?next=%2Fapi%2Fv%2Fgiveaways%2Ftwitch%2Fcallback%3Fcode%3Dtest-code%26state%3Dtest-state',
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

    const overlayToken = overlayTokenFromSettings();
    const overlayResponse = await getGiveawayStateRoute(new Request(`http://localhost/api/v/giveaways/state?overlayToken=${overlayToken}`));
    const overlayPayload = await overlayResponse.json();

    expect(overlayResponse.status).toBe(200);
    expect(overlayPayload.queueCount).toBe(1);
    expect(overlayPayload.connection.connected).toBe(true);
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
    expect(selectResponse.status).toBe(200);

    await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const finalRevealResponse = await postRevealTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/reveal', { method: 'POST' }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const finalRevealPayload = await finalRevealResponse.json();

    expect(finalRevealResponse.status).toBe(200);
    expect(finalRevealPayload.result.result).toBe('win');

    const completeResponse = await postCompleteTurnRoute(new Request('http://localhost/api/v/giveaways/turns/1/complete', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: String(queuedTurn.id) }),
    });
    const completePayload = await completeResponse.json();

    expect(completeResponse.status).toBe(200);
    expect(completePayload.result.status).toBe('completed');
    expect(completePayload.result.result).toBe('win');
  });

  it('stores broadcaster tokens and syncs the managed reward and subscription during connect completion', async () => {
    authMock.mockResolvedValue({ user: { id: String(operatorUserId) } });
    const actor = getUserById(context.db, operatorUserId);
    expect(actor).toBeTruthy();

    await beginGhostedTwitchPlatformConnect(actor!, '/v/twitch/');
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
