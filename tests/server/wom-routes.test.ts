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
        inGroup: false,
        membership: null,
        lastSyncedAt: null,
        status: 'unlinked',
      },
    });
  });
});
