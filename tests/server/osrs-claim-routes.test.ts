import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { PLAYER } from './wom-fixtures';
import { saveUserGameAccount } from '@/lib/server/wom';
import { setUserPublicNameSource } from '@/lib/server/osrs-identity';

const { authMock, cookiesMock, sendDiscordDirectMessageMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  cookiesMock: vi.fn(),
  sendDiscordDirectMessageMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/lib/server/discord', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/discord')>('@/lib/server/discord');
  return {
    ...actual,
    sendDiscordDirectMessage: sendDiscordDirectMessageMock,
  };
});

import { POST as postOsrsClaimChallengeRoute } from '@/app/api/profile/osrs-claim-challenge/route';
import { POST as postOsrsClaimRedeemRoute } from '@/app/api/plugin/osrs-claim/redeem/route';

function extractClaimCode(message: string) {
  const match = /One-time code:\s*([A-Z0-9]+)/.exec(message);
  if (!match) {
    throw new Error(`Expected one-time code in DM payload: ${message}`);
  }
  return match[1];
}

describe('OSRS claim routes', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({ WOM_GROUP_ID: '' });
    authMock.mockReset();
    cookiesMock.mockReset();
    sendDiscordDirectMessageMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('issues a one-time OSRS claim challenge to the linked Discord user', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    sendDiscordDirectMessageMock.mockResolvedValue(undefined);

    const response = await postOsrsClaimChallengeRoute();
    const payload = await response.json();
    const storedChallenge = context.db.prepare(`
      SELECT requested_username, status
      FROM osrs_claim_challenges
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(userId) as { requested_username: string; status: string } | undefined;

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.challenge.requestedUsername).toBe(PLAYER.username);
    expect(sendDiscordDirectMessageMock).toHaveBeenCalledTimes(1);
    expect(sendDiscordDirectMessageMock).toHaveBeenCalledWith(
      'discord-1',
      expect.stringContaining(`RuneScape username: ${PLAYER.username}`),
    );
    expect(storedChallenge).toEqual({
      requested_username: PLAYER.username,
      status: 'issued',
    });
  });

  it('rejects mismatched and expired claim redemptions', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);

    let issuedMessage = '';
    sendDiscordDirectMessageMock.mockImplementation(async (_discordId: string, content: string) => {
      issuedMessage = content;
    });

    await postOsrsClaimChallengeRoute();
    const code = extractClaimCode(issuedMessage);

    const mismatchResponse = await postOsrsClaimRedeemRoute(new Request('http://localhost/api/plugin/osrs-claim/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, username: 'Wrong Name' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const mismatchPayload = await mismatchResponse.json();

    expect(mismatchResponse.status).toBe(400);
    expect(mismatchPayload).toEqual({ error: 'That RuneScape username does not match the issued claim challenge.' });

    context.db.prepare(`
      UPDATE osrs_claim_challenges
      SET expires_at = '2026-04-10T00:00:00.000Z'
      WHERE user_id = ?
    `).run(userId);

    const expiredResponse = await postOsrsClaimRedeemRoute(new Request('http://localhost/api/plugin/osrs-claim/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, username: PLAYER.username }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const expiredPayload = await expiredResponse.json();

    expect(expiredResponse.status).toBe(410);
    expect(expiredPayload).toEqual({ error: 'That claim code has expired.' });
  });

  it('redeems a valid claim once and upgrades the linked OSRS identity to plugin verified', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    setUserPublicNameSource(context.db, userId, 'discord');

    let issuedMessage = '';
    sendDiscordDirectMessageMock.mockImplementation(async (_discordId: string, content: string) => {
      issuedMessage = content;
    });

    await postOsrsClaimChallengeRoute();
    const code = extractClaimCode(issuedMessage);

    const redeemResponse = await postOsrsClaimRedeemRoute(new Request('http://localhost/api/plugin/osrs-claim/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, username: PLAYER.username }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const redeemPayload = await redeemResponse.json();
    const accountRow = context.db.prepare(`
      SELECT claim_source, verified_at
      FROM user_game_accounts
      WHERE user_id = ? AND game = 'osrs'
    `).get(userId) as { claim_source: string; verified_at: string | null };
    const userRow = context.db.prepare(`
      SELECT public_name_source
      FROM users
      WHERE id = ?
    `).get(userId) as { public_name_source: string };
    const challengeRow = context.db.prepare(`
      SELECT status, redeemed_username, redeemed_at
      FROM osrs_claim_challenges
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(userId) as { status: string; redeemed_username: string | null; redeemed_at: string | null };

    expect(redeemResponse.status).toBe(200);
    expect(redeemPayload.ok).toBe(true);
    expect(redeemPayload.result.claimSource).toBe('runelite_plugin');
    expect(redeemPayload.result.publicNameSource).toBe('osrs');
    expect(redeemPayload.result.verifiedAt).toEqual(expect.any(String));
    expect(accountRow.claim_source).toBe('runelite_plugin');
    expect(accountRow.verified_at).toEqual(expect.any(String));
    expect(userRow.public_name_source).toBe('osrs');
    expect(challengeRow.status).toBe('redeemed');
    expect(challengeRow.redeemed_username).toBe(PLAYER.username);
    expect(challengeRow.redeemed_at).toEqual(expect.any(String));

    const reusedResponse = await postOsrsClaimRedeemRoute(new Request('http://localhost/api/plugin/osrs-claim/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, username: PLAYER.username }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const reusedPayload = await reusedResponse.json();

    expect(reusedResponse.status).toBe(404);
    expect(reusedPayload).toEqual({ error: 'That claim code is invalid or has already been used.' });
  });
});
