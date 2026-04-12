/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminOverviewData } from '@/lib/types';
import AdminPage from '@/app/admin/page';

function makePayload(): AdminOverviewData {
  return {
    actor: { displayName: 'Admin User' },
    overview: {
      users: [
        { id: 1, discordId: 'user-1', displayName: 'Admin User', balance: 2500, isAdmin: true },
      ],
      giveaways: [
        { id: 5, title: 'Moon bundle', status: 'active' },
      ],
      wom: { configured: true, linkedUsers: 12 },
      newsCount: 2,
    },
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
    sectionSummaries: [
      {
        key: 'rewards',
        label: 'Rewards',
        href: '/admin/rewards/',
        status: 'ready',
        primary: '1 live drop',
        secondary: '0 direct balance updates in the last 24 hours.',
        chips: ['1 tracked balances', '0 scheduled'],
      },
      {
        key: 'content',
        label: 'Content',
        href: '/admin/content/',
        status: 'warning',
        primary: '1 published dispatches',
        secondary: '1 draft dispatch is waiting for review.',
        chips: ['1 drafts', '1 recently published'],
      },
      {
        key: 'systems',
        label: 'Systems',
        href: '/admin/systems/',
        status: 'warning',
        primary: 'Wise Old Man linked to Ghosted',
        secondary: 'Discord worker health is stale.',
        chips: ['12 Wise Old Man links', '1 public channels'],
      },
      {
        key: 'ghostling',
        label: 'Ghostling',
        href: '/admin/ghostling/',
        status: 'ready',
        primary: '4 visible cosmetics live',
        secondary: '1 item is hidden from the member catalog.',
        chips: ['5 total cosmetics', '1 hidden'],
      },
    ],
    quickActionReferenceData: {
      roles: [
        { id: 'vip', name: 'VIP' },
      ],
    },
    recentAudit: [
      {
        id: 1,
        action: 'create_news_post',
        actionLabel: 'Save dispatch',
        section: 'content',
        targetType: 'news_post',
        targetId: '7',
        actorDisplayName: 'Admin User',
        createdAt: '2026-04-11T18:00:00.000Z',
        summary: 'Saved dispatch "Welcome back" as published.',
      },
    ],
  };
}

describe('AdminPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the compact action rail, dense status rows, and recent audit from the overview payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makePayload()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: 'Admin command hub' })).not.toBeNull();
    const rail = screen.getByLabelText('Primary admin actions');
    const readback = screen.getByLabelText('Verification and recent state');
    const railHeadings = within(rail).getAllByRole('heading', { level: 2 }).map((node) => node.textContent);

    expect(railHeadings).toEqual([
      'Grant points',
      'Create drop',
      'Publish dispatch',
      'Refresh Wise Old Man',
    ]);
    expect(rail.parentElement?.firstElementChild).toBe(rail);
    expect(rail.parentElement?.lastElementChild).toBe(readback);
    expect(within(readback).getByRole('heading', { name: 'Section state' })).not.toBeNull();
    expect(within(readback).getByRole('heading', { name: 'Recent admin actions' })).not.toBeNull();
    expect(await screen.findByText('Discord worker needs attention. The worker heartbeat is stale. Recheck the worker before trusting the public homepage scene.')).not.toBeNull();
    expect(await screen.findByText('Saved dispatch "Welcome back" as published.')).not.toBeNull();
    expect((await screen.findAllByText('1 live drop')).length).toBeGreaterThan(0);
  });

  it('requires an inline review step before publishing a dispatch from the hub', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 8, slug: 'launch', title: 'Launch', status: 'published', publishedAt: '2026-04-11T18:00:00.000Z' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminPage />);

    await screen.findByText('Admin command hub');

    const dispatchCard = screen.getByText('Publish dispatch').closest('section');
    expect(dispatchCard).not.toBeNull();
    const dispatchScope = within(dispatchCard!);

    fireEvent.change(dispatchScope.getByLabelText('Title'), { target: { value: 'Launch' } });
    fireEvent.change(dispatchScope.getByLabelText('Excerpt'), { target: { value: 'Tonight at reset.' } });
    fireEvent.change(dispatchScope.getByLabelText('Body'), { target: { value: 'We are publishing now.' } });
    fireEvent.change(dispatchScope.getByLabelText('Status'), { target: { value: 'published' } });
    fireEvent.click(dispatchScope.getByRole('button', { name: 'Save dispatch' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Confirm public dispatch')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const publishCall = fetchMock.mock.calls[1];
    expect(publishCall?.[0]).toBe('/api/admin/news');
    expect(publishCall?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(publishCall?.[1]?.body))).toMatchObject({
      title: 'Launch',
      status: 'published',
    });
  });
});
