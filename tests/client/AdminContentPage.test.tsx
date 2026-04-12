/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminContentData } from '@/lib/types';
import AdminContentPage from '@/app/admin/content/page';

function makePayload(): AdminContentData {
  return {
    actor: { displayName: 'Admin User' },
    alerts: [],
    sectionSummary: {
      key: 'content',
      label: 'Content',
      href: '/admin/content/',
      status: 'warning',
      primary: '1 published dispatches',
      secondary: '1 draft dispatch is waiting for review.',
      chips: ['1 drafts', '1 recently published'],
    },
    stats: {
      draftCount: 1,
      publishedCount: 1,
      recentlyPublishedCount: 1,
    },
    posts: [
      {
        id: 4,
        slug: 'welcome',
        title: 'Welcome back',
        excerpt: 'Tonight at reset.',
        body: 'Long body',
        status: 'published',
        publishedAt: '2026-04-11T18:00:00.000Z',
        createdAt: '2026-04-11T18:00:00.000Z',
        updatedAt: '2026-04-11T18:00:00.000Z',
        authorDisplayName: 'Admin User',
      },
    ],
    recentAudit: [
      {
        id: 1,
        action: 'create_news_post',
        actionLabel: 'Save dispatch',
        section: 'content',
        targetType: 'news_post',
        targetId: '4',
        actorDisplayName: 'Admin User',
        createdAt: '2026-04-11T18:00:00.000Z',
        summary: 'Saved dispatch "Welcome back" as published.',
      },
    ],
  };
}

describe('AdminContentPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires confirmation before deleting a dispatch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...makePayload(), posts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminContentPage />);

    expect(await screen.findByRole('heading', { name: 'Dispatch operations' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Dispatch register' })).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText('Confirm delete')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const deleteCall = fetchMock.mock.calls[1];
    expect(deleteCall?.[0]).toBe('/api/admin/news/4');
    expect(deleteCall?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
