/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuneliteLinkStatus, ShellData, WomMeData } from '@/lib/types';
import ProfilePage from '@/app/hall/profile/page';

function makeShellData(overrides: Partial<ShellData['wom']> = {}): ShellData {
  return {
    authenticated: true,
    brand: { label: 'Ghosted', href: '/' },
    navigation: [],
    links: {},
    utilityGroups: {},
    activeRouteKey: 'profile',
    auth: { canSignIn: true, loginHref: '/auth/login?next=%2Fhall%2Fprofile%2F' },
    user: {
      id: 1,
      discordId: 'discord-1',
      username: 'discord-member',
      displayName: 'Discord Member',
      publicNameSource: 'discord',
      balance: 4200,
      isAdmin: false,
      perks: [],
      roles: [],
      roleDetails: [],
      womLink: {
        linked: Boolean(overrides.linked),
        username: overrides.username ?? 'GhostedRSN',
        displayName: overrides.displayName ?? 'Ghosted RSN',
        publicNameSource: overrides.publicNameSource ?? 'discord',
        claimSource: overrides.claimSource ?? 'manual_wom',
        verifiedAt: overrides.verifiedAt ?? null,
        inGroup: Boolean(overrides.inGroup ?? overrides.linked),
        membership: overrides.membership ?? { rankLabel: 'Event Captain', role: 'Event Captain', groupName: 'Ghosted' },
        lastSyncedAt: overrides.lastSyncedAt ?? '2026-04-13T19:00:00.000Z',
      },
    },
    wom: {
      configured: true,
      linked: Boolean(overrides.linked),
      username: overrides.username ?? 'GhostedRSN',
      displayName: overrides.displayName ?? 'Ghosted RSN',
      publicNameSource: overrides.publicNameSource ?? 'discord',
      claimSource: overrides.claimSource ?? 'manual_wom',
      verifiedAt: overrides.verifiedAt ?? null,
      inGroup: Boolean(overrides.inGroup ?? overrides.linked),
      membership: overrides.membership ?? { rankLabel: 'Event Captain', role: 'Event Captain', groupName: 'Ghosted' },
      lastSyncedAt: overrides.lastSyncedAt ?? '2026-04-13T19:00:00.000Z',
    },
  };
}

function makeWomMeData(): WomMeData {
  return {
    player: {
      id: 555,
      username: 'GhostedRSN',
      displayName: 'Ghosted RSN',
      build: 'main',
      status: 'active',
      updatedAt: '2026-04-13T19:00:00.000Z',
    },
    membership: {
      role: 'Event Captain',
      rankLabel: 'Event Captain',
      groupName: 'Ghosted',
    },
    achievements: [],
    competitions: [],
  };
}

function installProfileFetchMock({
  shellData,
  womMeData,
  runeliteLink,
}: {
  shellData: ShellData;
  womMeData: WomMeData | null;
  runeliteLink: RuneliteLinkStatus;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, 'http://localhost');

    if (url.pathname === '/api/site-shell') {
      return new Response(JSON.stringify(shellData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/wom/me') {
      if (!womMeData) {
        return new Response(JSON.stringify({ error: 'Link a Wise Old Man RuneScape account first.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(womMeData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/profile/runelite-link') {
      return new Response(JSON.stringify(runeliteLink), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unhandled path ${url.pathname}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ProfilePage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('promotes Ghosted Authenticator as the preferred verification path and removes the old DM-code CTA', async () => {
    installProfileFetchMock({
      shellData: makeShellData({ linked: true }),
      womMeData: makeWomMeData(),
      runeliteLink: {
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

    render(<ProfilePage />);

    expect(await screen.findByText('Wise Old Man is linked, and Ghosted Authenticator is ready to upgrade it to a verified plugin claim.')).not.toBeNull();
    expect(await screen.findByText(/Ghosted Authenticator is the preferred verification path\./)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Send RuneLite verification code' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Remove manual Wise Old Man link' })).not.toBeNull();
  });

  it('shows the linked Ghosted Authenticator state and unlink action when the plugin claim is already verified', async () => {
    installProfileFetchMock({
      shellData: makeShellData({
        linked: true,
        claimSource: 'runelite_plugin',
        verifiedAt: '2026-04-13T19:05:00.000Z',
        publicNameSource: 'osrs',
      }),
      womMeData: makeWomMeData(),
      runeliteLink: {
        linked: true,
        accountHash: '1234567890123456789',
        username: 'GhostedRSN',
        launcherDisplayName: 'Ghosted Main',
        pluginVersion: '0.1.0',
        linkedAt: '2026-04-13T19:05:00.000Z',
        lastVerifiedAt: '2026-04-13T19:05:00.000Z',
        lastSeenAt: '2026-04-13T19:05:00.000Z',
      },
    });

    render(<ProfilePage />);

    expect(await screen.findByText('Ghosted Authenticator is linked and verified.')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Unlink Ghosted Authenticator' })).not.toBeNull();
    expect(await screen.findByText(/Linked account hash:/)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove manual Wise Old Man link' })).toBeNull();
  });
});
