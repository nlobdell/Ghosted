'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  Highlight,
  MetricGrid,
  DenseTable,
  EmptyState,
  Banner,
  FormField,
} from '@/components/ui/AppUI';
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

function normalizeAdminCopy(text: string) {
  return text
    .replace(/\bWOM\b/g, 'Wise Old Man')
    .replaceAll('Companion', 'Ghostling')
    .replaceAll('companion', 'Ghostling');
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
      .catch((nextError) => setError(nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Failed to load operator data.'))
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
      setMessage({ text: 'Points granted. Recheck the user balance table below.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? normalizeAdminCopy(err.message) : 'Grant failed.', variant: 'error' });
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
      setMessage({ text: 'Drop created. Confirm it appears on Hall rewards.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? normalizeAdminCopy(err.message) : 'Create failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWomRefresh = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await getJSON('/api/admin/wom/refresh', { method: 'POST' });
      setMessage({ text: 'Wise Old Man data refreshed. Recheck Hall clan and competition data.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? normalizeAdminCopy(err.message) : 'Refresh failed.', variant: 'error' });
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
      setMessage({ text: 'Dispatch saved. Review the record below before sharing it.', variant: 'info' });
      event.currentTarget.reset();
    } catch (err) {
      setMessage({ text: err instanceof Error ? normalizeAdminCopy(err.message) : 'Dispatch publish failed.', variant: 'error' });
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
      setMessage({ text: 'Dispatch deleted. Confirm it is gone from the records below.', variant: 'info' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? normalizeAdminCopy(err.message) : 'Delete failed.', variant: 'error' });
    } finally {
      setDeletingPostId(null);
    }
  };

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="Loading operator controls..." variant="info" />
      </main>
    );
  }

  const activeGiveaways = data?.overview.giveaways.filter((giveaway) => giveaway.status === 'active').length ?? 0;
  const adminCount = data?.overview.users.filter((user) => user.isAdmin).length ?? 0;
  const publishedNewsCount = newsPosts.filter((post) => post.status === 'published').length;

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Hall', href: '/hall/' },
          { label: 'Admin' },
        ]}
        title="Change live Ghosted state"
        summary="Grant points, publish drops, refresh Wise Old Man data, and manage dispatches here. After each change, verify the current sync and records below."
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <Panel
        className="admin-workbench"
        tier="primary"
        eyebrow="Live changes"
        title="Run admin actions"
        bodyClassName={styles.workbenchLayout}
        body={(
          <>
            <div className={styles.workbenchPrimary}>
              <section className={styles.workbenchSection}>
                <div className={styles.workbenchSectionHeader}>
                  <h3>Grant points</h3>
                  <p>Change a member balance directly, then verify the updated balance and ledger below.</p>
                </div>
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
                  <button className="button" type="submit" disabled={submitting}>Grant points</button>
                </form>
              </section>

              <section className={styles.workbenchSection}>
                <div className={styles.workbenchSectionHeader}>
                  <h3>Create drop</h3>
                  <p>Set the prize, point cost, access gate, and end time here, then confirm the drop on Hall rewards.</p>
                </div>
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
                  <button className="button" type="submit" disabled={submitting}>Create drop</button>
                </form>
              </section>

              <section className={styles.workbenchSection}>
                <div className={styles.workbenchSectionHeader}>
                  <h3>Publish dispatch</h3>
                  <p>Save the next public update here, then confirm its status and link in the records below.</p>
                </div>
                <form onSubmit={handleCreateNews} className="app-form">
                  <FormField label="Title">
                    <input name="title" type="text" placeholder="Dispatch headline" className="input-base" required />
                  </FormField>
                  <FormField label="Excerpt">
                    <input name="excerpt" type="text" placeholder="One-sentence summary" className="input-base" required />
                  </FormField>
                  <FormField label="Body">
                    <textarea name="body" rows={6} className="input-base" placeholder="Write the dispatch..." required />
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
                  <button className="button" type="submit" disabled={submitting}>Save dispatch</button>
                </form>
              </section>
            </div>

            <aside className={styles.workbenchSecondary}>
              <section className={styles.consequenceSection}>
                <div className={styles.workbenchSectionHeader}>
                  <h3>Verify after each change</h3>
                  <p>Use these checks to confirm the live drop count, public dispatch count, and Wise Old Man link total after an update lands.</p>
                </div>
                <MetricGrid
                  items={[
                    ['Active drops', String(activeGiveaways)],
                    ['Published dispatches', String(publishedNewsCount)],
                    ['Wise Old Man links', String(data?.overview.wom?.linkedUsers ?? 0)],
                    ['Current actor', data?.actor.displayName ?? 'Unknown'],
                  ]}
                />
                <p className="app-panel-note">
                  Ghostling files, visibility, and slot order live in their own admin route so asset changes stay separate from points and dispatch work.
                </p>
              </section>

              <section className={styles.workbenchVault}>
                <span className="app-chip">Ghostling assets</span>
                <h3>Manage Ghostling files</h3>
                <p>Upload, hide, restore, reorder, and replace Ghostling files in the dedicated admin route.</p>
                <Link href="/admin/ghostling/" className="button button--secondary button--small">
                  Open Ghostling admin
                </Link>
              </section>
            </aside>
          </>
        )}
      />

      <Highlight
        className="admin-highlight"
        eyebrow="System state"
        title="Verify the live state"
        copy="Check operator identity, Wise Old Man sync health, and the current campaign counts here after you make a change."
        stage={{
          label: 'Current operator',
          primary: `Actor: ${data?.actor.displayName ?? 'Unknown'}`,
          secondary: data?.overview.wom?.configured ? `Wise Old Man live with ${data?.overview.wom?.linkedUsers ?? 0} linked users` : 'Wise Old Man offline',
          chips: [`${activeGiveaways} live giveaways`, `${adminCount} admin users`],
        }}
      />

      <StatStrip
        className="admin-scoreboard"
        leadIndex={0}
        stats={[
          { label: 'Tracked users', value: String(data?.overview.users.length ?? 0) },
          { label: 'Live giveaways', value: String(activeGiveaways) },
          { label: 'Wise Old Man links', value: String(data?.overview.wom?.linkedUsers ?? 0) },
          { label: 'Published dispatches', value: String(publishedNewsCount) },
        ]}
      />

      <AppGrid className={styles.secondaryGrid}>
        <Panel
          className="admin-sync"
          tier="meta"
          eyebrow="Sync"
          title="Refresh Wise Old Man"
          chip={data?.overview.wom?.configured ? 'Live' : 'Offline'}
          body={(
            <div className="app-stack">
              <MetricGrid
                items={[
                  ['Linked users', String(data?.overview.wom?.linkedUsers ?? 0)],
                  ['Group config', data?.overview.wom?.configured ? 'Ready' : 'Missing Wise Old Man group config'],
                ]}
              />
              <p className="app-panel-note">
                Ghosted keeps Wise Old Man group data read-only. Refresh clears cached data so Hall clan and competition views catch up to the latest sync.
              </p>
              <button
                className="button"
                type="button"
                onClick={handleWomRefresh}
                disabled={submitting || !data?.overview.wom?.configured}
              >
                Refresh Wise Old Man
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
                ['Wise Old Man', data?.overview.wom?.configured ? 'Live' : 'Offline'],
                ['Users', String(data?.overview.users.length ?? 0)],
                ['Giveaways', String(data?.overview.giveaways.length ?? 0)],
              ]}
            />
          )}
        />
      </AppGrid>

      <AppGrid className={styles.auditGrid}>
        <Panel
          className="admin-users"
          tier="meta"
          eyebrow="Audit"
          title="User balances"
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
          eyebrow="Audit"
          title="Giveaway status"
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

      <Panel
        className="admin-news-list"
        tier="meta"
        eyebrow="Audit"
        title="Dispatch records"
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
                  <Link href={`/news/${post.slug}/`} className="button button--secondary button--small">Open dispatch</Link>
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
          <EmptyState message="No dispatches created yet." />
        )}
      />
    </main>
  );
}
