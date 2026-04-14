import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from '@/app/(public)/auth/login/page';

describe('auth login page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders a branded Discord sign-in page and normalizes unsafe callback targets', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');
    vi.stubEnv('DISCORD_REDIRECT_URI', 'https://ghostedclan.com/api/auth/callback/discord');

    const markup = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ next: 'https://evil.example/phish' }),
    }));

    expect(markup).toContain('Secure Discord sign-in');
    expect(markup).toContain('Ghosted checkpoint');
    expect(markup).toContain('Continue with Discord');
    expect(markup).toContain('/api/auth/signin?callbackUrl=%2F');
  });

  it('reflects RuneLite pairing as the return destination when the login page is opened from account linking', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    vi.stubEnv('DISCORD_CLIENT_ID', 'discord-client-id');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-client-secret');

    const markup = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ next: '/runelite/link?code=Q7KM-2L9P' }),
    }));

    expect(markup).toContain('RuneLite pairing');
    expect(markup).toContain('RuneLite pairing approval');
    expect(markup).toContain('/api/auth/signin?callbackUrl=%2Frunelite%2Flink%3Fcode%3DQ7KM-2L9P');
  });

  it('renders a branded unavailable state when Discord auth is missing', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    vi.stubEnv('DISCORD_CLIENT_ID', '');
    vi.stubEnv('DISCORD_CLIENT_SECRET', '');

    const markup = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ next: '/hall/' }),
    }));

    expect(markup).toContain('Discord sign-in is not configured on this deployment yet.');
    expect(markup).not.toContain('Continue with Discord');
  });
});
