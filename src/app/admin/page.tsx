'use client';
import { useEffect, useState } from 'react';
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
} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';

interface AdminOverview {
  actor: { displayName: string };
  overview: {
    users: { id: number; displayName: string; balance: number; isAdmin: boolean }[];
    giveaways: { id: number; title: string; status: string }[];
    wom: { configured: boolean; linkedUsers: number } | null;
  };
}

interface DiscordRolesPayload {
  roles: { id: string; name: string }[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      getJSON<AdminOverview>('/api/admin/overview'),
      getJSON<DiscordRolesPayload>('/api/admin/discord-roles'),
    ])
      .then(([nextData, nextRoles]) => {
        setData(nextData);
        setRoles(nextRoles.roles ?? []);
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

  if (loading) {
    return (
      <main className="page-shell">
        <Banner message="Loading admin data..." variant="info" />
      </main>
    );
  }

  const activeGiveaways = data?.overview.giveaways.filter((giveaway) => giveaway.status === 'active').length ?? 0;
  const adminCount = data?.overview.users.filter((user) => user.isAdmin).length ?? 0;

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Admin' },
        ]}
        title="Operator console"
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}

      <StatStrip
        stats={[
          { label: 'Tracked users', value: String(data?.overview.users.length ?? 0) },
          { label: 'Live giveaways', value: String(activeGiveaways) },
          { label: 'WOM links', value: String(data?.overview.wom?.linkedUsers ?? 0) },
          { label: 'Admin users', value: String(adminCount) },
        ]}
      />

      <Highlight
        eyebrow="Admin"
        title="Run Ghosted"
        copy="Grant points, launch drops, and refresh WOM data."
        chips={[`Actor: ${data?.actor.displayName ?? ''}`, data?.overview.wom?.configured ? 'WOM live' : 'WOM offline']}
        theme="admin"
      />

      <AppGrid>
        <Panel
          eyebrow="Points"
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
          eyebrow="Giveaways"
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
          eyebrow="Wise Old Man"
          title="Data refresh"
          chip={data?.overview.wom?.configured ? 'Live' : 'Offline'}
          body={
            <div className="app-stack">
              <MetricGrid
                items={[
                  ['Linked users', String(data?.overview.wom?.linkedUsers ?? 0)],
                  ['Group config', data?.overview.wom?.configured ? 'Ready' : 'Missing WOM_GROUP_ID'],
                ]}
              />
              <p className="app-panel-note">
                Ghosted is intentionally read-only for the WOM group. Refresh clears cache drift without editing membership.
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
          }
        />

        <Panel
          eyebrow="Status"
          title="System overview"
          body={
            <MetricGrid
              items={[
                ['Auth', data ? 'Configured' : 'Unknown'],
                ['WOM', data?.overview.wom?.configured ? 'Live' : 'Offline'],
                ['Users', String(data?.overview.users.length ?? 0)],
                ['Giveaways', String(data?.overview.giveaways.length ?? 0)],
              ]}
            />
          }
        />
      </AppGrid>

      <AppGrid>
        <Panel
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
