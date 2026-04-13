import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { OUTSIDER_GROUPS, PLAYER, PLAYER_GROUPS, installWomFetchMock } from './wom-fixtures';
import { utcIso } from '@/lib/server/core';
import { saveUserGameAccount, updateUserGameAccountClaimMetadata } from '@/lib/server/wom';
import { setUserPublicNameSource } from '@/lib/server/osrs-identity';

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

import { POST as postRunelitePairingStartRoute } from '@/app/api/runelite/pairings/start/route';
import { GET as getRunelitePairingStatusRoute } from '@/app/api/runelite/pairings/status/route';
import { POST as postRunelitePairingConfirmRoute } from '@/app/api/runelite/pairings/confirm/route';
import { DELETE as deleteRuneliteLinkRoute, GET as getRuneliteLinkRoute } from '@/app/api/profile/runelite-link/route';

function insertRuneliteLink(
  context: ServerTestContext,
  input: {
    accountHash: string;
    userId: number;
    username?: string;
    launcherDisplayName?: string | null;
    pluginVersion?: string | null;
  },
) {
  const nowIso = utcIso();
  context.db.prepare(`
    INSERT INTO runelite_account_links (
      account_hash,
      user_id,
      current_username,
      launcher_display_name,
      plugin_version,
      linked_at,
      last_verified_at,
      last_seen_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.accountHash,
    input.userId,
    input.username ?? PLAYER.username,
    input.launcherDisplayName ?? 'Ghosted Main',
    input.pluginVersion ?? '0.1.0',
    nowIso,
    nowIso,
    nowIso,
    nowIso,
    nowIso,
  );
}

async function startPairing(accountHash: string, username = PLAYER.username) {
  const response = await postRunelitePairingStartRoute(new Request('http://localhost/api/runelite/pairings/start', {
    method: 'POST',
    body: JSON.stringify({
      accountHash,
      username,
      launcherDisplayName: 'Ghosted Main',
      pluginVersion: '0.1.0',
    }),
    headers: { 'Content-Type': 'application/json' },
  }));
  return {
    response,
    payload: await response.json(),
  };
}

describe('RuneLite pairing routes', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment();
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

  it('requires auth for profile link reads, deletes, and pairing confirmation', async () => {
    authMock.mockResolvedValue(null);

    const [getResponse, deleteResponse, confirmResponse] = await Promise.all([
      getRuneliteLinkRoute(),
      deleteRuneliteLinkRoute(),
      postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
        method: 'POST',
        body: JSON.stringify({ userCode: 'ABCD-EFGH' }),
        headers: { 'Content-Type': 'application/json' },
      })),
    ]);

    expect(getResponse.status).toBe(401);
    expect(await getResponse.json()).toEqual({ error: 'Please sign in with Discord first.' });
    expect(deleteResponse.status).toBe(401);
    expect(await deleteResponse.json()).toEqual({ error: 'Please sign in with Discord first.' });
    expect(confirmResponse.status).toBe(401);
    expect(await confirmResponse.json()).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('creates a pending pairing and records the plugin-facing contract', async () => {
    const { response, payload } = await startPairing('1234567890123456789');
    const pairingRow = context.db.prepare(`
      SELECT requested_account_hash, requested_username, status
      FROM runelite_pairings
      ORDER BY created_at DESC
      LIMIT 1
    `).get() as { requested_account_hash: string; requested_username: string; status: string } | undefined;
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      ORDER BY id DESC
      LIMIT 1
    `).get() as { action: string } | undefined;

    expect(response.status).toBe(201);
    expect(payload.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(payload.pollToken).toEqual(expect.any(String));
    expect(payload.verificationUrl).toContain(`/runelite/link?code=${encodeURIComponent(payload.userCode)}`);
    expect(payload.pollAfterSeconds).toBe(5);
    expect(pairingRow).toEqual({
      requested_account_hash: '1234567890123456789',
      requested_username: PLAYER.username,
      status: 'pending',
    });
    expect(auditRow?.action).toBe('start_runelite_pairing');
  });

  it('returns already_linked when the account hash is already claimed and refreshes the stored username', async () => {
    const userId = insertUser(context.db);
    insertRuneliteLink(context, {
      accountHash: '1234567890123456789',
      userId,
      username: 'OldName',
    });

    const { response, payload } = await startPairing('1234567890123456789', 'RenamedRSN');
    const storedRow = context.db.prepare(`
      SELECT current_username
      FROM runelite_account_links
      WHERE account_hash = ?
    `).get('1234567890123456789') as { current_username: string };

    expect(response.status).toBe(200);
    expect(payload.status).toBe('already_linked');
    expect(payload.link.linked).toBe(true);
    expect(payload.link.accountHash).toBe('1234567890123456789');
    expect(payload.link.username).toBe('RenamedRSN');
    expect(storedRow.current_username).toBe('RenamedRSN');
  });

  it('confirms a pairing, marks the OSRS identity as plugin verified, and returns approved status while polling', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock();

    const started = await startPairing('1234567890123456789');
    const confirmResponse = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const confirmPayload = await confirmResponse.json();
    const statusResponse = await getRunelitePairingStatusRoute(new Request(`http://localhost/api/runelite/pairings/status?pollToken=${encodeURIComponent(started.payload.pollToken)}`));
    const statusPayload = await statusResponse.json();
    const linkRow = context.db.prepare(`
      SELECT account_hash, current_username
      FROM runelite_account_links
      WHERE user_id = ?
    `).get(userId) as { account_hash: string; current_username: string };
    const accountRow = context.db.prepare(`
      SELECT username, claim_source, verified_at
      FROM user_game_accounts
      WHERE user_id = ? AND game = 'osrs'
    `).get(userId) as { username: string; claim_source: string; verified_at: string | null };
    const userRow = context.db.prepare(`
      SELECT public_name_source
      FROM users
      WHERE id = ?
    `).get(userId) as { public_name_source: string };

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.link.linked).toBe(true);
    expect(confirmPayload.link.accountHash).toBe('1234567890123456789');
    expect(confirmPayload.link.username).toBe(PLAYER.username);
    expect(confirmPayload.wom.claimSource).toBe('runelite_plugin');
    expect(statusResponse.status).toBe(200);
    expect(statusPayload).toEqual({
      status: 'approved',
      link: {
        accountHash: '1234567890123456789',
        username: PLAYER.username,
        linkedAt: confirmPayload.link.linkedAt,
        womLinked: true,
      },
    });
    expect(linkRow).toEqual({
      account_hash: '1234567890123456789',
      current_username: PLAYER.username,
    });
    expect(accountRow.username).toBe(PLAYER.username);
    expect(accountRow.claim_source).toBe('runelite_plugin');
    expect(accountRow.verified_at).toEqual(expect.any(String));
    expect(userRow.public_name_source).toBe('osrs');
  });

  it('marks expired pairings as terminal during status polling', async () => {
    const started = await startPairing('1234567890123456789');
    context.db.prepare(`
      UPDATE runelite_pairings
      SET expires_at = '2026-04-10T00:00:00.000Z'
      WHERE id = ?
    `).run(started.payload.pairingId);

    const response = await getRunelitePairingStatusRoute(new Request(`http://localhost/api/runelite/pairings/status?pollToken=${encodeURIComponent(started.payload.pollToken)}`));
    const payload = await response.json();
    const pairingRow = context.db.prepare(`
      SELECT status
      FROM runelite_pairings
      WHERE id = ?
    `).get(started.payload.pairingId) as { status: string };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: 'expired',
      expiresAt: '2026-04-10T00:00:00.000Z',
    });
    expect(pairingRow.status).toBe('expired');
  });

  it('rejects confirmation when the RuneLite account hash is already linked to another Ghosted user', async () => {
    const existingUserId = insertUser(context.db, {
      discordId: 'discord-existing',
      username: 'existing',
      globalName: 'Existing Member',
    });
    const newUserId = insertUser(context.db, {
      discordId: 'discord-new',
      username: 'new-user',
      globalName: 'New Member',
    });
    authMock.mockResolvedValue({ user: { id: String(newUserId) } });
    installWomFetchMock();

    const started = await startPairing('1234567890123456789');
    insertRuneliteLink(context, {
      accountHash: '1234567890123456789',
      userId: existingUserId,
      username: PLAYER.username,
    });
    const response = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const pairingRow = context.db.prepare(`
      SELECT status
      FROM runelite_pairings
      WHERE id = ?
    `).get(started.payload.pairingId) as { status: string };

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: 'That RuneLite account is already linked to a different Ghosted user.' });
    expect(pairingRow.status).toBe('conflict');
  });

  it('denies confirmation when the requested player is not in the configured WOM group', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock({
      'GET /players/GhostedRSN/groups': OUTSIDER_GROUPS,
    });

    const started = await startPairing('1234567890123456789');
    const response = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const pairingRow = context.db.prepare(`
      SELECT status
      FROM runelite_pairings
      WHERE id = ?
    `).get(started.payload.pairingId) as { status: string };
    const linkRow = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM runelite_account_links
      WHERE user_id = ?
    `).get(userId) as { count: number };

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'That Wise Old Man player is not in the configured Ghosted group.' });
    expect(pairingRow.status).toBe('denied');
    expect(linkRow.count).toBe(0);
  });

  it('falls back to a regular WOM player lookup when the hiscores refresh is temporarily unavailable', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-fallback',
      username: 'fallback-user',
      globalName: 'Fallback User',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock({
      'POST /players/GhostedRSN': new Response(JSON.stringify({
        code: 'HISCORES_UNEXPECTED_ERROR',
        message: 'Hiscores connection refused',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      'GET /players/GhostedRSN': PLAYER,
      'GET /players/GhostedRSN/groups': PLAYER_GROUPS,
    });

    const started = await startPairing('1234567890123456789');
    const confirmResponse = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const confirmPayload = await confirmResponse.json();

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.link.username).toBe(PLAYER.username);
  });

  it('returns a friendly 503 when WOM cannot refresh or look up the player during pairing confirmation', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-wom-down',
      username: 'wom-down',
      globalName: 'WOM Down',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock({
      'POST /players/GhostedRSN': new Response(JSON.stringify({
        code: 'HISCORES_UNEXPECTED_ERROR',
        message: 'Hiscores connection refused',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      'GET /players/GhostedRSN': new Response(JSON.stringify({
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const started = await startPairing('1234567890123456789');
    const response = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: 'Wise Old Man is temporarily unable to refresh that player from the hiscores. Try again in a few minutes.',
    });
  });

  it('replaces the current users previous RuneLite link when they pair a new account', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    const oldPlayer = {
      ...PLAYER,
      id: 777,
      username: 'OldGhost',
      displayName: 'Old Ghost',
    };
    const altPlayer = {
      ...PLAYER,
      id: 778,
      username: 'AltGhost',
      displayName: 'Alt Ghost',
    };
    insertRuneliteLink(context, {
      accountHash: '1111111111111111111',
      userId,
      username: oldPlayer.username,
    });
    saveUserGameAccount(context.db, userId, 'osrs', oldPlayer);
    updateUserGameAccountClaimMetadata(context.db, userId, 'osrs', {
      claimSource: 'runelite_plugin',
      verifiedAt: utcIso(),
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock({
      'POST /players/AltGhost': altPlayer,
      'GET /players/AltGhost/groups': PLAYER_GROUPS,
    });

    const started = await startPairing('2222222222222222222', altPlayer.username);
    const response = await postRunelitePairingConfirmRoute(new Request('http://localhost/api/runelite/pairings/confirm', {
      method: 'POST',
      body: JSON.stringify({ userCode: started.payload.userCode }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const links = context.db.prepare(`
      SELECT account_hash, current_username
      FROM runelite_account_links
      WHERE user_id = ?
      ORDER BY account_hash
    `).all(userId) as Array<{ account_hash: string; current_username: string }>;
    const accountRow = context.db.prepare(`
      SELECT username, wom_player_id, claim_source
      FROM user_game_accounts
      WHERE user_id = ? AND game = 'osrs'
    `).get(userId) as { username: string; wom_player_id: number; claim_source: string };
    const replaceAudit = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'replace_runelite_account_link'
      ORDER BY id DESC
      LIMIT 1
    `).get() as { action: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.link.accountHash).toBe('2222222222222222222');
    expect(links).toEqual([
      { account_hash: '2222222222222222222', current_username: 'AltGhost' },
    ]);
    expect(accountRow).toEqual({
      username: 'AltGhost',
      wom_player_id: 778,
      claim_source: 'runelite_plugin',
    });
    expect(replaceAudit?.action).toBe('replace_runelite_account_link');
  });

  it('unlinks the current plugin-verified OSRS identity from the profile route', async () => {
    const userId = insertUser(context.db, {
      discordId: 'discord-1',
      username: 'member',
      globalName: 'Discord Member',
    });
    insertRuneliteLink(context, {
      accountHash: '1234567890123456789',
      userId,
      username: PLAYER.username,
    });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    updateUserGameAccountClaimMetadata(context.db, userId, 'osrs', {
      claimSource: 'runelite_plugin',
      verifiedAt: utcIso(),
    });
    setUserPublicNameSource(context.db, userId, 'osrs');
    authMock.mockResolvedValue({ user: { id: String(userId) } });

    const getBeforeResponse = await getRuneliteLinkRoute();
    const getBeforePayload = await getBeforeResponse.json();
    const deleteResponse = await deleteRuneliteLinkRoute();
    const deletePayload = await deleteResponse.json();
    const remainingLinks = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM runelite_account_links
      WHERE user_id = ?
    `).get(userId) as { count: number };
    const remainingAccounts = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM user_game_accounts
      WHERE user_id = ? AND game = 'osrs'
    `).get(userId) as { count: number };
    const userRow = context.db.prepare(`
      SELECT public_name_source
      FROM users
      WHERE id = ?
    `).get(userId) as { public_name_source: string };

    expect(getBeforeResponse.status).toBe(200);
    expect(getBeforePayload).toMatchObject({
      linked: true,
      accountHash: '1234567890123456789',
      username: PLAYER.username,
    });
    expect(deleteResponse.status).toBe(200);
    expect(deletePayload).toEqual({
      ok: true,
      message: 'RuneLite account unlinked.',
      link: {
        linked: false,
        accountHash: null,
        username: null,
        launcherDisplayName: null,
        pluginVersion: null,
        linkedAt: null,
        lastVerifiedAt: null,
        lastSeenAt: null,
      },
    });
    expect(remainingLinks.count).toBe(0);
    expect(remainingAccounts.count).toBe(0);
    expect(userRow.public_name_source).toBe('discord');
  });
});
