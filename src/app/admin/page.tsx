'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  ArchitectureMap,
  Highlight,
  MetricGrid,
  DenseTable,
  EmptyState,
  Banner,
  FormField,
} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import type { NewsPost } from '@/lib/types';
import styles from './page.module.css';

interface AdminOverview {
  actor: { displayName: string };
  overview: {
    users: { id: number; displayName: string; balance: number; isAdmin: boolean }[];
    giveaways: { id: number; title: string; status: string }[];
    wom: { configured: boolean; linkedUsers: number } | null;
    newsCount?: number;
  };
}

interface DiscordRolesPayload {
  roles: { id: string; name: string }[];
}

interface AdminNewsPayload {
  posts: NewsPost[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      getJSON<AdminOverview>('/api/admin/overview'),
      getJSON<DiscordRolesPayload>('/api/admin/discord-roles'),
      getJSON<AdminNewsPayload>('/api/admin/news?limit=50'),
    ])
      .then(([nextData, nextRoles, nextNews]) => {
        setData(nextData);
        setRoles(nextRoles.roles ?? []);
        setNewsPosts(nextNews.posts ?? []);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Failed to load admin data.'))
      .finally(() => setLoading(false));
  }, []);

  const handleGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage(null);
    try {
      await getJSON('/api/admin/rewards/grant', {
        method: 'POST',
        body: JSON.stringify({
          userId: formData.get('userId'),
          amount: Number(formData.get('amount')),
          description: formData.get('description'),
        }),
      });
      setMessage({ text: 'Points granted.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Grant failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGiveaway = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage(null);
    try {
      await getJSON('/api/admin/giveaways', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.get('title'),
          description: formData.get('description'),
          pointCost: Number(formData.get('pointCost')),
          maxEntries: Number(formData.get('maxEntries')),
          endAt: formData.get('endAt'),
          requiredRoleId: formData.get('requiredRoleId') || undefined,
        }),
      });
      setMessage({ text: 'Giveaway created.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Create failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWomRefresh = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await getJSON('/api/admin/wom/refresh', { method: 'POST' });
      setMessage({ text: 'WOM data refreshed.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Refresh failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNews = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage(null);
    try {
      await getJSON('/api/admin/news', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.get('title'),
          excerpt: formData.get('excerpt'),
          body: formData.get('body'),
          status: formData.get('status'),
          publishedAt: formData.get('publishedAt') || undefined,
        }),
      });
      const refreshed = await getJSON<AdminNewsPayload>('/api/admin/news?limit=50');
      setNewsPosts(refreshed.posts ?? []);
      setMessage({ text: 'News post saved.', variant: 'info' });
      event.currentTarget.reset();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'News publish failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNews = async (postId: number) => {
    setDeletingPostId(postId);
    setMessage(null);
    try {
      await getJSON(`/api/admin/news/${postId}`, { method: 'DELETE' });
      setNewsPosts((current) => current.filter((post) => post.id !== postId));
      setMessage({ text: 'News post deleted.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Delete failed.', variant: 'error' });
    } finally {
      setDeletingPostId(null);
    }
  };

  if (loading) {
    return (
      <main className={`page-shell ${styles.page}`}>
        <Banner message="Loading admin data..." variant="info" />
      </main>
    );
  }

  const activeGiveaways = data?.overview.giveaways.filter((giveaway) => giveaway.status === 'active').length ?? 0;
  const adminCount = data?.overview.users.filter((user) => user.isAdmin).length ?? 0;
  const publishedNewsCount = newsPosts.filter((post) => post.status === 'published').length;

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Hall', href: '/app/' },
          { label: 'Admin' },
        ]}
        title="Operator console"
        summary="Execute economy actions first, verify sync health second, and use tables last for audits."
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <AppGrid>
        <Panel
          className="admin-actions admin-grant"
          tier="primary"
          eyebrow="Workflow"
          title="Grant points"
          body={
            <form onSubmit={handleGrant} className="app-form">
              <FormField label="User ID or Discord ID">
                <input name="userId" type="text" placeholder="User ID" className="input-base" required />
              </FormField>
              <FormField label="Amount">
                <input name="amount" type="number" placeholder="100" className="input-base" required />
              </FormField>
              <FormField label="Description">
                <input name="description" type="text" placeholder="Reason" className="input-base" />
              </FormField>
              <button className="button" type="submit" disabled={submitting}>Grant</button>
            </form>
          }
        />

        <Panel
          className="admin-actions admin-create"
          tier="primary"
          eyebrow="Workflow"
          title="Create giveaway"
          body={
            <form onSubmit={handleCreateGiveaway} className="app-form">
              <FormField label="Title">
                <input name="title" type="text" placeholder="Prize name" className="input-base" required />
              </FormField>
              <FormField label="Description">
                <input name="description" type="text" placeholder="Optional" className="input-base" />
              </FormField>
              <div className="form-grid-two">
                <FormField label="Point cost">
                  <input name="pointCost" type="number" placeholder="50" className="input-base" required />
                </FormField>
                <FormField label="Max entries">
                  <input name="maxEntries" type="number" placeholder="10" className="input-base" required />
                </FormField>
              </div>
              <FormField label="End date">
                <input name="endAt" type="datetime-local" className="input-base" required />
              </FormField>
              <FormField label="Required role (optional)">
                <select name="requiredRoleId" className="input-base">
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </FormField>
              <button className="button" type="submit" disabled={submitting}>Create</button>
            </form>
          }
        />
      </AppGrid>

      <AppGrid>
        <Panel
          className="admin-actions admin-news-create"
          tier="primary"
          eyebrow="Content"
          title="Publish news update"
          body={(
            <form onSubmit={handleCreateNews} className="app-form">
              <FormField label="Title">
                <input name="title" type="text" placeholder="Update headline" className="input-base" required />
              </FormField>
              <FormField label="Excerpt">
                <input name="excerpt" type="text" placeholder="One-sentence summary" className="input-base" required />
              </FormField>
              <FormField label="Body">
                <textarea name="body" rows={6} className="input-base" placeholder="Write the update..." required />
              </FormField>
              <div className="form-grid-two">
                <FormField label="Status">
                  <select name="status" className="input-base" defaultValue="draft">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </FormField>
                <FormField label="Publish at (optional)">
                  <input name="publishedAt" type="datetime-local" className="input-base" />
                </FormField>
              </div>
              <button className="button" type="submit" disabled={submitting}>Save post</button>
            </form>
          )}
        />
        <Panel
          className="admin-news-list"
          tier="meta"
          eyebrow="Content"
          title="Recent news posts"
          body={newsPosts.length ? (
            <div className="app-feed">
              {newsPosts.slice(0, 10).map((post) => (
                <article key={post.id} className="app-feed__item">
                  <div className="app-card__row">
                    <strong>{post.title}</strong>
                    <span className="app-chip">{post.status}</span>
                  </div>
                  <div className="app-feed__meta">{post.excerpt}</div>
                  <div className="app-inline-actions">
                    <Link href={`/news/${post.slug}/`} className="button button--secondary button--small">Open</Link>
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      onClick={() => handleDeleteNews(post.id)}
                      disabled={deletingPostId === post.id}
                    >
                      {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No news posts created yet." />
          )}
        />
      </AppGrid>

      <StatStrip
        className="admin-scoreboard"
        leadIndex={0}
        stats={[
          { label: 'Tracked users', value: String(data?.overview.users.length ?? 0) },
          { label: 'Live giveaways', value: String(activeGiveaways) },
          { label: 'WOM links', value: String(data?.overview.wom?.linkedUsers ?? 0) },
          { label: 'Published news', value: String(publishedNewsCount) },
        ]}
      />

      <Highlight
        className="admin-highlight"
        eyebrow="Operator state"
        title="System snapshot"
        copy="Manage the economy first, then verify sync and records."
        stage={{
          label: 'Operator signal',
          primary: `Actor: ${data?.actor.displayName ?? 'Unknown'}`,
          secondary: data?.overview.wom?.configured ? 'WOM live (Group 6371)' : 'WOM offline',
          chips: [`${activeGiveaways} live giveaways`, `${adminCount} admin users`],
        }}
      />

      <AppGrid>
        <Panel
          className="admin-sync"
          tier="meta"
          eyebrow="Sync"
          title="Wise Old Man refresh"
          chip={data?.overview.wom?.configured ? 'Live' : 'Offline'}
          body={(
            <div className="app-stack">
              <MetricGrid
                items={[
                  ['Linked users', String(data?.overview.wom?.linkedUsers ?? 0)],
                  ['Group config', data?.overview.wom?.configured ? 'Ready' : 'Missing WOM_GROUP_ID'],
                ]}
              />
              <p className="app-panel-note">
                Ghosted keeps WOM group data read-only. Refresh clears cache drift without editing live clan membership.
              </p>
              <button
                className="button"
                type="button"
                onClick={handleWomRefresh}
                disabled={submitting || !data?.overview.wom?.configured}
              >
                Refresh WOM
              </button>
            </div>
          )}
        />

        <Panel
          className="admin-health"
          tier="meta"
          eyebrow="Status"
          title="System health"
          body={(
            <MetricGrid
              items={[
                ['Auth', data ? 'Configured' : 'Unknown'],
                ['WOM', data?.overview.wom?.configured ? 'Live' : 'Offline'],
                ['Users', String(data?.overview.users.length ?? 0)],
                ['Giveaways', String(data?.overview.giveaways.length ?? 0)],
              ]}
            />
          )}
        />
      </AppGrid>

      <ArchitectureMap
        title="Operations playbook"
        copy="Workflow first, verification second, records last."
        nodes={[
          {
            label: 'Economy',
            title: 'Points and ledger controls',
            copy: 'Grant or correct points and verify balances that drive member casino play and giveaway participation.',
            chips: ['Rewards ledger', 'Balance corrections'],
          },
          {
            label: 'Drops',
            title: 'Campaign lifecycle',
            copy: 'Create campaigns with role gates, entry costs, and status progression mapped to member routes.',
            chips: ['Role-gated entries', 'Campaign state'],
          },
          {
            label: 'Sync',
            title: 'External data health',
            copy: 'Refresh WOM-backed data and validate runtime health across auth, users, and integrations.',
            chips: [data?.overview.wom?.configured ? 'WOM configured' : 'WOM missing', 'System status'],
          },
          {
            label: 'Content',
            title: 'Clan communications',
            copy: 'Publish official updates to the public news feed from one moderated admin workflow.',
            chips: [`${publishedNewsCount} published`, `${newsPosts.length} total posts`],
          },
        ]}
      />

      <AppGrid>
        <Panel
          className="admin-users"
          tier="meta"
          title="Users"
          body={(
            <DenseTable
              columns={['ID', 'User', 'Balance']}
              rows={(data?.overview.users ?? []).map((user) => [String(user.id), user.displayName, formatPoints(user.balance)])}
              emptyMessage="No users found."
            />
          )}
        />

        <Panel
          className="admin-giveaways"
          tier="meta"
          title="Giveaway draws"
          body={
            data?.overview.giveaways.length ? (
              <DenseTable
                columns={['ID', 'Title', 'Status']}
                rows={data.overview.giveaways.map((giveaway) => [String(giveaway.id), giveaway.title, giveaway.status])}
                emptyMessage="No giveaways."
              />
            ) : (
              <EmptyState message="No giveaways published yet." />
            )
          }
        />
      </AppGrid>
    </main>
  );
}
