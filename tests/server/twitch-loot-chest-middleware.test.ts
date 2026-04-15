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

    const response = await middleware(new NextRequest('https://ghostedclan.com/v'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://ghostedclan.com/auth/login?next=%2Fv');
  });

  it('redirects signed-out requests for the setup tab', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v?tab=setup'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://ghostedclan.com/auth/login?next=%2Fv%3Ftab%3Dsetup');
  });

  it('redirects signed-out requests for the host overlay route', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/host'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://ghostedclan.com/auth/login?next=%2Fv%2Fhost');
  });

  it('allows the tokenized overlay through without login', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/overlay?token=opaque-token'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('still allows the legacy tokenized overlay path through without login', async () => {
    vi.stubEnv('ENABLE_DEV_AUTH', 'false');
    getTokenMock.mockResolvedValue(null);

    const response = await middleware(new NextRequest('https://ghostedclan.com/v/giveaways/overlay/opaque-token'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
