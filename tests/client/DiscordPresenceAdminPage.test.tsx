/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminSystemsData } from '@/lib/types';
import AdminSystemsPage from '@/app/admin/systems/page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function makePayload(overrides: Partial<AdminSystemsData> = {}): AdminSystemsData {
  return {
    actor: { displayName: 'Admin User' },
    alerts: [],
    sectionSummary: {
      key: 'systems',
      label: 'Systems',
      href: '/admin/systems/',
      status: 'ready',
      primary: 'Wise Old Man linked to Ghosted',
      secondary: 'Discord worker health is healthy.',
      chips: ['12 Wise Old Man links', '1 public channels'],
    },
    wom: {
      configured: true,
      linkedUsers: 12,
    },
    discord: {
      actor: { displayName: 'Admin User' },
      guild: {
        id: 'ghosted-guild',
        configured: true,
        ready: true,
      },
      publicMode: 'bot',
      worker: {
        configured: true,
        guildId: 'ghosted-guild',
        health: 'healthy',
        state: {
          guildId: 'ghosted-guild',
          runtimeStatus: 'running',
          botInstallStatus: 'installed',
          lastHeartbeatAt: '2026-04-11T18:00:00.000Z',
          lastSyncAt: '2026-04-11T18:00:00.000Z',
          lastError: null,
          updatedAt: '2026-04-11T18:00:00.000Z',
        },
        activeModules: [
          { key: 'voicePresence', label: 'Voice presence', enabled: true },
        ],
      },
      channels: [
        { id: 'voice-1', name: 'Lounge', type: 'voice', selected: true },
        { id: 'stage-1', name: 'Main Stage', type: 'stage', selected: false },
      ],
      allowlist: [
        {
          guildId: 'ghosted-guild',
          channelId: 'voice-1',
          channelName: 'Lounge',
          channelType: 'voice',
          updatedAt: '2026-04-11T18:00:00.000Z',
        },
      ],
      channelFetchError: null,
    },
    recentAudit: [
      {
        id: 1,
        action: 'refresh_wom_cache',
        actionLabel: 'Refresh Wise Old Man',
        section: 'systems',
        targetType: 'wom_cache',
        targetId: 'all',
        actorDisplayName: 'Admin User',
        createdAt: '2026-04-11T18:00:00.000Z',
        summary: 'Refreshed Wise Old Man cache for all.',
      },
    ],
    ...overrides,
  };
}

describe('AdminSystemsPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders worker status and saves the selected channel allowlist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload({
        discord: {
          ...makePayload().discord,
          channels: [
            { id: 'voice-1', name: 'Lounge', type: 'voice', selected: true },
            { id: 'stage-1', name: 'Main Stage', type: 'stage', selected: true },
          ],
          allowlist: [
            {
              guildId: 'ghosted-guild',
              channelId: 'voice-1',
              channelName: 'Lounge',
              channelType: 'voice',
              updatedAt: '2026-04-11T18:00:00.000Z',
            },
            {
              guildId: 'ghosted-guild',
              channelId: 'stage-1',
              channelName: 'Main Stage',
              channelType: 'stage',
              updatedAt: '2026-04-11T18:00:00.000Z',
            },
          ],
        },
      })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSystemsPage />);

    expect(await screen.findByRole('heading', { name: 'Systems operations' })).not.toBeNull();
    expect((await screen.findAllByText('Bot-backed matching')).length).toBeGreaterThan(0);
    expect(screen.getByText('Voice presence')).not.toBeNull();
    expect((await screen.findAllByText('Lounge')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/Main Stage/i));
    fireEvent.click(screen.getByRole('button', { name: 'Save allowlist' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Confirm allowlist')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const postCall = fetchMock.mock.calls[1];
    expect(postCall?.[0]).toBe('/api/admin/discord-presence');
    expect(postCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      channelIds: ['voice-1', 'stage-1'],
    });

    expect(await screen.findByText('Public Discord presence channels updated. Recheck the homepage scene after the next worker sync.')).not.toBeNull();
  });

  it('surfaces widget fallback and stale-worker guidance when the worker is unhealthy', async () => {
    const base = makePayload();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makePayload({
      alerts: [
        {
          id: 'discord-worker-stale',
          title: 'Discord worker needs attention',
          detail: 'The worker heartbeat is stale. Recheck the worker before trusting the public homepage scene.',
          variant: 'warning',
          section: 'systems',
          href: '/admin/systems/',
          ctaLabel: 'Inspect systems',
        },
      ],
      discord: {
        ...base.discord,
        publicMode: 'widget',
        worker: {
          ...base.discord.worker,
          health: 'stale',
          state: {
            ...base.discord.worker.state!,
            lastHeartbeatAt: '2026-04-11T17:58:00.000Z',
            lastSyncAt: '2026-04-11T17:58:00.000Z',
          },
        },
        channelFetchError: 'Discord guild channel lookup failed. Check the bot install and local network access.',
      },
    })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSystemsPage />);

    expect((await screen.findAllByText('Widget fallback')).length).toBeGreaterThan(0);
    expect(await screen.findByText('The worker heartbeat is stale, so the homepage is using widget fallback until the worker catches up.')).not.toBeNull();
    expect(await screen.findByText('Discord guild channel lookup failed. Check the bot install and local network access.')).not.toBeNull();
  });
});
