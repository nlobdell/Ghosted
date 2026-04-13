import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { PLAYER, installWomFetchMock } from './wom-fixtures';
import { saveUserGameAccount } from '@/lib/server/wom';
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

import { GET as getSiteShellRoute } from '@/app/api/site-shell/route';

describe('site shell route', () => {
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

  it('prefers the claimed OSRS display name on public member-facing shell payloads', async () => {
    const userId = insertUser(context.db, {
      username: 'discord-member',
      globalName: 'Discord Member',
    });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    setUserPublicNameSource(context.db, userId, 'osrs');
    installWomFetchMock();

    const response = await getSiteShellRoute(new Request('http://localhost/api/site-shell?next=%2Fhall%2F'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.authenticated).toBe(true);
    expect(payload.user.displayName).toBe(PLAYER.displayName);
    expect(payload.user.publicNameSource).toBe('osrs');
    expect(payload.user.womLink.displayName).toBe(PLAYER.displayName);
    expect(payload.user.womLink.claimSource).toBe('manual_wom');
    expect(payload.wom.publicNameSource).toBe('osrs');
  });
});
