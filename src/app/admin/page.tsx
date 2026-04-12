'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { AdminOverviewData } from '@/lib/types';
import {
  AdminAuditFeed,
  AdminKeyValueList,
  AdminPageHeader,
  AdminPaneSection,
  AdminRailSection,
  AdminSectionStatusList,
  AdminWorkspace,
  InlineConfirmBar,
} from './admin-ui';
import styles from './admin-surface.module.css';

type PendingDispatchReview = {
  title: string;
  excerpt: string;
  body: string;
  status: 'draft' | 'published';
  publishedAt?: string;
};

function normalizeAdminCopy(text: string) {
  return text
    .replace(/\bWOM\b/g, 'Wise Old Man')
    .replaceAll('Companion', 'Ghostling')
    .replaceAll('companion', 'Ghostling');
}

function bannerVariant(variant: 'info' | 'warning' | 'error') {
  return variant;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [busyAction, setBusyAction] = useState<'grant' | 'drop' | 'dispatch' | 'wom' | null>(null);
  const [dispatchReview, setDispatchReview] = useState<PendingDispatchReview | null>(null);

  async function loadOverview() {
    const nextData = await getJSON<AdminOverviewData>('/api/admin/overview');
    setData(nextData);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadOverview())
      .catch((nextError) => {
        setError(nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Failed to load operator controls.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshAfterMutation(successText: string) {
    await loadOverview();
    setMessage({ text: successText, variant: 'info' });
  }

  async function handleGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyAction('grant');
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
      form.reset();
      await refreshAfterMutation('Points granted. Check rewards and recent audit.');
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Grant failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateDrop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyAction('drop');
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
      form.reset();
      await refreshAfterMutation('Drop created. Verify live state in Rewards.');
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Drop creation failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitDispatch(payload: PendingDispatchReview, form?: HTMLFormElement) {
    setBusyAction('dispatch');
    setMessage(null);
    try {
      await getJSON('/api/admin/news', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          excerpt: payload.excerpt,
          body: payload.body,
          status: payload.status,
          publishedAt: payload.publishedAt || undefined,
        }),
      });
      form?.reset();
      setDispatchReview(null);
      await refreshAfterMutation(
        payload.status === 'published'
          ? 'Dispatch published. Confirm the public record in Content.'
          : 'Draft dispatch saved.',
      );
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Dispatch save failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDispatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: PendingDispatchReview = {
      title: String(formData.get('title') ?? '').trim(),
      excerpt: String(formData.get('excerpt') ?? '').trim(),
      body: String(formData.get('body') ?? '').trim(),
      status: String(formData.get('status') ?? 'draft').trim().toLowerCase() === 'published' ? 'published' : 'draft',
      publishedAt: String(formData.get('publishedAt') ?? '').trim() || undefined,
    };

    if (payload.status === 'published') {
      setDispatchReview(payload);
      return;
    }

    await submitDispatch(payload, form);
  }

  async function handleRefreshWom() {
    setBusyAction('wom');
    setMessage(null);
    try {
      await getJSON('/api/admin/wom/refresh', { method: 'POST' });
      await refreshAfterMutation('Wise Old Man refreshed. Check systems health.');
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Wise Old Man refresh failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="Loading admin overview..." variant="info" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        {error ? <Banner message={error} variant="error" /> : null}
        <EmptyState
          message="Admin overview could not be loaded."
          action={<Link href="/hall/" className="button button--secondary button--small">Back to Hall</Link>}
        />
      </main>
    );
  }

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin' },
        ]}
        title="Admin command hub"
        summary="Run live admin actions from the rail, then read status and audit in the workspace pane."
        actions={(
          <>
            <Link href="/admin/rewards/" className="button button--secondary button--small">Rewards</Link>
            <Link href="/admin/systems/" className="button button--secondary button--small">Systems</Link>
          </>
        )}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      {data.alerts.length ? (
        <div className={styles.bannerStack}>
          {data.alerts.map((alert) => (
            <Banner
              key={alert.id}
              message={`${alert.title}. ${alert.detail}`}
              variant={bannerVariant(alert.variant)}
            />
          ))}
        </div>
      ) : null}

      <AdminWorkspace
        rail={(
          <>
            <AdminRailSection
              eyebrow="Grant"
              title="Grant points"
              description="Direct balance correction."
            >
              <form onSubmit={handleGrant} className={styles.formStack}>
                <FormField label="User ID or Discord ID">
                  <input name="userId" type="text" className="input-base" placeholder="User ID" required />
                </FormField>
                <div className={styles.fieldPair}>
                  <FormField label="Amount">
                    <input name="amount" type="number" className="input-base" placeholder="100" required />
                  </FormField>
                  <FormField label="Reason">
                    <input name="description" type="text" className="input-base" placeholder="Reason" required />
                  </FormField>
                </div>
                <button className="button" type="submit" disabled={busyAction === 'grant'}>
                  {busyAction === 'grant' ? 'Granting...' : 'Grant points'}
                </button>
              </form>
            </AdminRailSection>

            <AdminRailSection
              eyebrow="Drop"
              title="Create drop"
              description="Live or scheduled rewards drop."
            >
              <form onSubmit={handleCreateDrop} className={styles.formStack}>
                <FormField label="Title">
                  <input name="title" type="text" className="input-base" placeholder="Prize name" required />
                </FormField>
                <FormField label="Description">
                  <input name="description" type="text" className="input-base" placeholder="Member-facing description" required />
                </FormField>
                <div className={styles.fieldPair}>
                  <FormField label="Point cost">
                    <input name="pointCost" type="number" className="input-base" min="0" placeholder="50" required />
                  </FormField>
                  <FormField label="Max entries">
                    <input name="maxEntries" type="number" className="input-base" min="1" placeholder="10" required />
                  </FormField>
                </div>
                <div className={styles.fieldPair}>
                  <FormField label="End date">
                    <input name="endAt" type="datetime-local" className="input-base" required />
                  </FormField>
                  <FormField label="Required role">
                    <select name="requiredRoleId" className="input-base" defaultValue="">
                      <option value="">None</option>
                      {data.quickActionReferenceData.roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <button className="button" type="submit" disabled={busyAction === 'drop'}>
                  {busyAction === 'drop' ? 'Creating...' : 'Create drop'}
                </button>
              </form>
            </AdminRailSection>

            <AdminRailSection
              eyebrow="Dispatch"
              title="Publish dispatch"
              description="Draft or publish one update."
            >
              <form onSubmit={handleDispatchSubmit} className={styles.formStack}>
                <FormField label="Title">
                  <input name="title" type="text" className="input-base" placeholder="Headline" required />
                </FormField>
                <FormField label="Excerpt">
                  <input name="excerpt" type="text" className="input-base" placeholder="Summary" required />
                </FormField>
                <FormField label="Body">
                  <textarea name="body" rows={5} className="input-base" placeholder="Write the dispatch..." required />
                </FormField>
                <div className={styles.fieldPair}>
                  <FormField label="Status">
                    <select name="status" className="input-base" defaultValue="draft">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </FormField>
                  <FormField label="Publish at">
                    <input name="publishedAt" type="datetime-local" className="input-base" />
                  </FormField>
                </div>
                <button className="button" type="submit" disabled={busyAction === 'dispatch'}>
                  {busyAction === 'dispatch' ? 'Saving...' : 'Save dispatch'}
                </button>
              </form>

              {dispatchReview ? (
                <InlineConfirmBar
                  title="Confirm public dispatch"
                  detail="This dispatch will become visible on the public site."
                  meta={[
                    { label: 'Title', value: dispatchReview.title },
                    { label: 'Publish at', value: dispatchReview.publishedAt ? formatDate(dispatchReview.publishedAt) : 'Immediately' },
                  ]}
                  confirmLabel="Confirm publish"
                  pendingLabel="Publishing..."
                  busy={busyAction === 'dispatch'}
                  onConfirm={() => void submitDispatch(dispatchReview)}
                  onCancel={() => setDispatchReview(null)}
                />
              ) : null}
            </AdminRailSection>

            <AdminRailSection
              eyebrow="Sync"
              title="Refresh Wise Old Man"
              description="Clear cached clan state."
            >
              <AdminKeyValueList
                items={[
                  ['Configured', data.overview.wom?.configured ? 'Yes' : 'No'],
                  ['Linked users', String(data.overview.wom?.linkedUsers ?? 0)],
                ]}
              />
              <button
                type="button"
                className="button"
                disabled={busyAction === 'wom' || !data.overview.wom?.configured}
                onClick={() => void handleRefreshWom()}
              >
                {busyAction === 'wom' ? 'Refreshing...' : 'Refresh Wise Old Man'}
              </button>
            </AdminRailSection>
          </>
        )}
      >
        <AdminPaneSection eyebrow="Status" title="Section state">
          <AdminSectionStatusList summaries={data.sectionSummaries} />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Audit" title="Recent admin actions">
          <AdminAuditFeed entries={data.recentAudit} emptyMessage="No recent admin activity yet." />
        </AdminPaneSection>
      </AdminWorkspace>
    </main>
  );
}
