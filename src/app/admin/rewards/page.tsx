'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner, EmptyState, FormField } from '@/components/ui/AppUI';
import { formatDate, formatPoints, getJSON } from '@/lib/api';
import type { AdminRewardsData } from '@/lib/types';
import {
  AdminAuditFeed,
  AdminDataTable,
  AdminPageHeader,
  AdminPaneSection,
  AdminRailSection,
  AdminStatStrip,
  AdminWorkspace,
} from '../admin-ui';
import styles from '../admin-surface.module.css';

function normalizeAdminCopy(text: string) {
  return text
    .replace(/\bWOM\b/g, 'Wise Old Man')
    .replaceAll('Companion', 'Ghostling')
    .replaceAll('companion', 'Ghostling');
}

export default function AdminRewardsPage() {
  const [data, setData] = useState<AdminRewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [busyAction, setBusyAction] = useState<'grant' | 'drop' | null>(null);

  async function loadRewards() {
    const nextData = await getJSON<AdminRewardsData>('/api/admin/rewards');
    setData(nextData);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadRewards())
      .catch((nextError) => {
        setError(nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Failed to load rewards admin.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshAfterMutation(successText: string) {
    await loadRewards();
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
      await refreshAfterMutation('Points granted. Verify balances and rewards audit.');
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
      await refreshAfterMutation('Drop created. Verify live timing and entry state.');
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? normalizeAdminCopy(nextError.message) : 'Drop creation failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="Loading rewards admin..." variant="info" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        {error ? <Banner message={error} variant="error" /> : null}
        <EmptyState message="Rewards admin could not be loaded." action={<Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>} />
      </main>
    );
  }

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Rewards' },
        ]}
        title="Rewards operations"
        summary="Run direct economy actions in the rail, then verify balances, drop state, and audit in the main pane."
        actions={<Link href="/admin/" className="button button--secondary button--small">Back to hub</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}
      {data.alerts.map((alert) => (
        <Banner key={alert.id} message={`${alert.title}. ${alert.detail}`} variant={alert.variant} />
      ))}

      <AdminStatStrip
        items={[
          { label: 'Tracked users', value: String(data.stats.trackedUsers) },
          { label: 'Admin users', value: String(data.stats.adminUsers) },
          { label: 'Live drops', value: String(data.stats.activeGiveaways) },
          { label: 'Scheduled', value: String(data.stats.scheduledGiveaways) },
        ]}
      />

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
              description="Publish a rewards drop."
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
                    <input name="pointCost" type="number" className="input-base" min="0" required />
                  </FormField>
                  <FormField label="Max entries">
                    <input name="maxEntries" type="number" className="input-base" min="1" required />
                  </FormField>
                </div>
                <div className={styles.fieldPair}>
                  <FormField label="End date">
                    <input name="endAt" type="datetime-local" className="input-base" required />
                  </FormField>
                  <FormField label="Required role">
                    <select name="requiredRoleId" className="input-base" defaultValue="">
                      <option value="">None</option>
                      {data.roles.map((role) => (
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
          </>
        )}
      >
        <AdminPaneSection eyebrow="Verification" title="User balances">
          <AdminDataTable
            columns={['ID', 'User', 'Balance', 'Admin']}
            rows={data.users.map((user) => [
              String(user.id),
              <span key={`${user.id}-name`}>
                <span className={styles.tableStrong}>{user.displayName}</span>
                <span className={styles.tableSubtle}>{user.discordId}</span>
              </span>,
              formatPoints(user.balance),
              user.isAdmin ? 'Yes' : 'No',
            ])}
            emptyMessage="No users available yet."
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Verification" title="Drop state">
          <AdminDataTable
            columns={['ID', 'Drop', 'Status', 'Cost', 'Entries', 'Ends']}
            rows={data.giveaways.map((giveaway) => [
              String(giveaway.id),
              <span key={`${giveaway.id}-title`}>
                <span className={styles.tableStrong}>{giveaway.title}</span>
                <span className={styles.tableSubtle}>{giveaway.requiredRoleLabel ?? 'No role gate'}</span>
              </span>,
              giveaway.status,
              formatPoints(giveaway.pointCost),
              `${giveaway.totalEntries}/${giveaway.maxEntries}`,
              formatDate(giveaway.endAt),
            ])}
            emptyMessage="No drops exist yet."
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Audit" title="Recent rewards actions">
          <AdminAuditFeed entries={data.recentAudit} emptyMessage="No rewards audit entries yet." />
        </AdminPaneSection>
      </AdminWorkspace>
    </main>
  );
}
