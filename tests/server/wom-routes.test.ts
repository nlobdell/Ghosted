import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { PLAYER, installWomFetchMock } from './wom-fixtures';
import { saveUserGameAccount } from '@/lib/server/wom';
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

import { DELETE as deleteWomLinkRoute, POST as postWomLinkRoute } from '@/app/api/profile/wom-link/route';
import { DELETE as deletePublicNameSourceRoute, POST as postPublicNameSourceRoute } from '@/app/api/profile/public-name-source/route';
import { GET as getWomClanRoute } from '@/app/api/wom/clan/route';
import { GET as getWomCompetitionsRoute } from '@/app/api/wom/competitions/route';
import { GET as getWomMeRoute } from '@/app/api/wom/me/route';

describe('wom route handlers', () => {
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

  it('returns 401 for unauthenticated WOM me requests', async () => {
    authMock.mockResolvedValue(null);

    const response = await getWomMeRoute();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('returns 404 for WOM me when no linked account exists', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });

    const response = await getWomMeRoute();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Link a Wise Old Man RuneScape account first.' });
  });

  it('returns the linked WOM me payload when authenticated', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    installWomFetchMock();

    const response = await getWomMeRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.player.id).toBe(PLAYER.id);
    expect(payload.membership.rankLabel).toBe('Event Captain');
  });

  it('returns the clan payload with Skill of the Week standings', async () => {
    installWomFetchMock();

    const response = await getWomClanRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.skillOfTheWeek.mode).toBe('active');
    expect(payload.skillOfTheWeek.competition.displayTitle).toBe('Agility Skill of the Week');
    expect(payload.skillOfTheWeek.standings[0].displayValue).toBe(4000);
  });

  it('returns competitions with normalized participant counts', async () => {
    installWomFetchMock();

    const response = await getWomCompetitionsRoute(new Request('http://localhost/api/wom/competitions?limit=12'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.competitions[0].participantCount).toBe(472);
    expect(payload.competitions[0].displayTitle).toBe('Agility Skill of the Week');
  });

  it('returns 401 when linking a WOM account without auth', async () => {
    authMock.mockResolvedValue(null);

    const response = await postWomLinkRoute(new Request('http://localhost/api/profile/wom-link', {
      method: 'POST',
      body: JSON.stringify({ username: 'GhostedRSN' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('returns the expected envelope for successful WOM linking', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    installWomFetchMock();

    const response = await postWomLinkRoute(new Request('http://localhost/api/profile/wom-link', {
      method: 'POST',
      body: JSON.stringify({ username: 'GhostedRSN' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('WOM account linked.');
    expect(payload.result.playerId).toBe(PLAYER.id);
    expect(payload.result.publicNameSource).toBe('osrs');
    expect(payload.result.claimSource).toBe('manual_wom');
    expect(payload.result.verifiedAt).toBeNull();
  });

  it('returns the expected envelope for unlinking a WOM account', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);

    const response = await deleteWomLinkRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      message: 'WOM account unlinked.',
      result: {
        linked: false,
        playerId: null,
        username: null,
        displayName: null,
        publicNameSource: 'discord',
        claimSource: null,
        verifiedAt: null,
        inGroup: false,
        membership: null,
        lastSyncedAt: null,
        status: 'unlinked',
      },
    });
  });

  it('updates the public name source without unlinking the linked WOM account', async () => {
    const userId = insertUser(context.db, { username: 'discord-member', globalName: 'Discord Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    installWomFetchMock();

    const switchToOsrsResponse = await postPublicNameSourceRoute(new Request('http://localhost/api/profile/public-name-source', {
      method: 'POST',
      body: JSON.stringify({ source: 'osrs' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const switchToOsrsPayload = await switchToOsrsResponse.json();

    expect(switchToOsrsResponse.status).toBe(200);
    expect(switchToOsrsPayload.ok).toBe(true);
    expect(switchToOsrsPayload.result.linked).toBe(true);
    expect(switchToOsrsPayload.result.publicNameSource).toBe('osrs');
    expect(switchToOsrsPayload.result.username).toBe(PLAYER.username);

    const switchToDiscordResponse = await deletePublicNameSourceRoute();
    const switchToDiscordPayload = await switchToDiscordResponse.json();

    expect(switchToDiscordResponse.status).toBe(200);
    expect(switchToDiscordPayload.ok).toBe(true);
    expect(switchToDiscordPayload.result.linked).toBe(true);
    expect(switchToDiscordPayload.result.publicNameSource).toBe('discord');
    expect(switchToDiscordPayload.result.playerId).toBe(PLAYER.id);
  });

  it('rejects OSRS public-name selection when no linked WOM account exists', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });

    const response = await postPublicNameSourceRoute(new Request('http://localhost/api/profile/public-name-source', {
      method: 'POST',
      body: JSON.stringify({ source: 'osrs' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Link a Wise Old Man RuneScape account before using it as your public name.' });
  });
});
