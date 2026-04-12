/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminRewardsData } from '@/lib/types';
import AdminRewardsPage from '@/app/admin/rewards/page';

function makePayload(): AdminRewardsData {
  return {
    actor: { displayName: 'Admin User' },
    alerts: [],
    sectionSummary: {
      key: 'rewards',
      label: 'Rewards',
      href: '/admin/rewards/',
      status: 'ready',
      primary: '1 live drop',
      secondary: '0 direct balance updates in the last 24 hours.',
      chips: ['1 tracked balances', '0 scheduled'],
    },
    stats: {
      trackedUsers: 1,
      adminUsers: 1,
      activeGiveaways: 1,
      scheduledGiveaways: 0,
      recentGrantCount: 0,
    },
    roles: [{ id: 'vip', name: 'VIP' }],
    users: [
      { id: 1, discordId: 'admin-user', displayName: 'Admin User', balance: 2500, isAdmin: true },
    ],
    giveaways: [
      { id: 5, title: 'Moon bundle', status: 'active', pointCost: 50, maxEntries: 10, totalEntries: 3, endAt: '2026-04-11T20:00:00.000Z', requiredRoleLabel: null },
    ],
    recentAudit: [
      {
        id: 1,
        action: 'grant_points',
        actionLabel: 'Grant points',
        section: 'rewards',
        targetType: 'user',
        targetId: '1',
        actorDisplayName: 'Admin User',
        createdAt: '2026-04-11T18:00:00.000Z',
        summary: 'Granted 100 pts to user #1.',
      },
    ],
  };
}

describe('AdminRewardsPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the action rail, verification tables, and audit feed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makePayload()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminRewardsPage />);

    expect(await screen.findByRole('heading', { name: 'Rewards operations' })).not.toBeNull();
    const rail = screen.getByLabelText('Primary admin actions');
    const readback = screen.getByLabelText('Verification and recent state');

    expect(within(rail).getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'Grant points',
      'Create drop',
    ]);
    expect(within(readback).getByRole('heading', { name: 'User balances' })).not.toBeNull();
    expect(within(readback).getByRole('heading', { name: 'Drop state' })).not.toBeNull();
    expect(await screen.findByText('Moon bundle')).not.toBeNull();
    expect(await screen.findByText('Granted 100 pts to user #1.')).not.toBeNull();
  });
});
