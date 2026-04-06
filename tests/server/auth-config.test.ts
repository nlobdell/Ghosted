import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthSecret } from '@/lib/auth/config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAuthSecret', () => {
  it('returns the configured AUTH_SECRET when present', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_SECRET', '  custom-secret  ');

    expect(getAuthSecret()).toBe('custom-secret');
  });

  it('returns the local development fallback when AUTH_SECRET is missing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_SECRET', '');

    expect(getAuthSecret()).toBe('ghosted-local-dev-auth-secret');
  });

  it('does not inject a fallback in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');

    expect(getAuthSecret()).toBeUndefined();
  });
});
