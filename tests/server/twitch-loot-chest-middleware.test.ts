import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({
  getToken: getTokenMock,
}));

import middleware from '../../middleware';

describe('twitch operator middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('redirects signed-out requests for the platform home', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/twitch/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://ghostedclan.com/auth/login?next=%2Fv%2Ftwitch%2F');
  });

  it('redirects signed-out requests for the giveaway operator route', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/giveaways/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://ghostedclan.com/auth/login?next=%2Fv%2Fgiveaways%2F');
  });

  it('allows the tokenized overlay through without login', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/giveaways/overlay/opaque-token'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
