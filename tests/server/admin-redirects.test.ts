import { describe, expect, it, vi } from 'vitest';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('redirected');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import DiscordPresenceAdminRedirectPage from '@/app/admin/discord-presence/page';

describe('legacy admin redirects', () => {
  it('redirects the old discord presence route into systems', () => {
    expect(() => DiscordPresenceAdminRedirectPage()).toThrow('redirected');
    expect(redirectMock).toHaveBeenCalledWith('/admin/systems?panel=discord-presence');
  });
});
