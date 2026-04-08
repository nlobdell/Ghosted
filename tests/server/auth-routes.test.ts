import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

import { GET as getLoginRoute } from '@/app/auth/login/route';

describe('auth login route', () => {
  beforeEach(() => {
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('redirects straight to the Discord provider endpoint on the configured public origin', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');
    vi.stubEnv('DISCORD_REDIRECT_URI', 'https://ghosted.smirkhub.com/api/auth/callback/discord');

    const response = await getLoginRoute(
      new Request('http://localhost/auth/login?next=/hall/profile/'),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://ghosted.smirkhub.com/api/auth/signin/discord?callbackUrl=%2Fhall%2Fprofile%2F',
    );
  });

  it('normalizes unsafe callback targets back to a local hall path', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');
    vi.stubEnv('AUTH_URL', 'https://ghosted.smirkhub.com');

    const response = await getLoginRoute(
      new Request('http://localhost/auth/login?next=https://evil.example/phish'),
    );

    expect(response.headers.get('location')).toBe(
      'https://ghosted.smirkhub.com/api/auth/signin/discord?callbackUrl=%2F',
    );
  });
});
