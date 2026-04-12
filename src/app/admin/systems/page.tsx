'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Banner, EmptyState } from '@/components/ui/AppUI';
import { formatDate, getJSON } from '@/lib/api';
import type { AdminSystemsData } from '@/lib/types';
import {
  AdminAuditFeed,
  AdminKeyValueList,
  AdminPageHeader,
  AdminPaneSection,
  AdminRailSection,
  AdminStatStrip,
  AdminWorkspace,
  InlineConfirmBar,
} from '../admin-ui';
import styles from '../admin-surface.module.css';

function formatWorkerHealth(health: AdminSystemsData['discord']['worker']['health']) {
  return health.replaceAll('-', ' ');
}

function publicModeLabel(mode: AdminSystemsData['discord']['publicMode']) {
  return mode === 'bot' ? 'Bot-backed matching' : 'Widget fallback';
}

function workerStatusCopy(data: AdminSystemsData['discord']) {
  if (!data.guild.ready) {
    return 'Set DISCORD_GUILD_ID and DISCORD_BOT_TOKEN before the bot-backed path can take over.';
  }
  if (data.worker.health === 'healthy') {
    return 'Homepage voice presence is resolving linked users through the Discord worker.';
  }
  if (data.worker.health === 'not-installed') {
    return 'The bot is not installed in the configured guild yet, so the homepage is using widget fallback.';
  }
  if (data.worker.health === 'stale') {
    return 'The worker heartbeat is stale, so the homepage is using widget fallback until the worker catches up.';
  }
  if (data.worker.health === 'error') {
    return 'The worker reported an error, so the homepage is using widget fallback.';
  }
  return 'The homepage is using widget fallback until the worker becomes healthy.';
}

export default function AdminSystemsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AdminSystemsData | null>(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [allowlistReview, setAllowlistReview] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'wom' | 'allowlist' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);

  async function loadSystems() {
    const nextData = await getJSON<AdminSystemsData>('/api/admin/systems');
    setData(nextData);
    setSelectedChannelIds(nextData.discord.channels.filter((channel) => channel.selected).map((channel) => channel.id));
    setAllowlistReview(null);
  }

  useEffect(() => {
    Promise.resolve()
      .then(() => loadSystems())
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load systems admin.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (!panel) return;
    const target = document.getElementById(panel);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
  }, [searchParams, data]);

  const selectedSet = useMemo(() => new Set(selectedChannelIds), [selectedChannelIds]);

  async function handleRefreshWom() {
    setBusyAction('wom');
    setMessage(null);
    try {
      await getJSON('/api/admin/wom/refresh', { method: 'POST' });
      await loadSystems();
      setMessage({
        text: 'Wise Old Man refreshed. Recheck systems health and clan-facing data.',
        variant: 'info',
      });
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? nextError.message : 'Wise Old Man refresh failed.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmAllowlistSave(channelIds: string[]) {
    setBusyAction('allowlist');
    setMessage(null);
    try {
      await getJSON('/api/admin/discord-presence', {
        method: 'POST',
        body: JSON.stringify({ channelIds }),
      });
      await loadSystems();
      setMessage({
        text: 'Public Discord presence channels updated. Recheck the homepage scene after the next worker sync.',
        variant: 'info',
      });
    } catch (nextError) {
      setMessage({
        text: nextError instanceof Error ? nextError.message : 'Failed to save the Discord allowlist.',
        variant: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  function toggleChannel(channelId: string) {
    setSelectedChannelIds((current) => (
      current.includes(channelId)
        ? current.filter((entry) => entry !== channelId)
        : [...current, channelId]
    ));
  }

  if (loading) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="Loading systems admin..." variant="info" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`page-shell workspace-page ${styles.page}`}>
        {error ? <Banner message={error} variant="error" /> : null}
        <EmptyState message="Systems admin could not be loaded." action={<Link href="/admin/" className="button button--secondary button--small">Back to admin</Link>} />
      </main>
    );
  }

  const setupWarning = !data.discord.guild.ready
    ? 'Discord guild sync is not configured yet. Set DISCORD_GUILD_ID and DISCORD_BOT_TOKEN before you expect bot-backed presence.'
    : data.discord.channelFetchError;

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      <AdminPageHeader
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Admin', href: '/admin/' },
          { label: 'Systems' },
        ]}
        title="Systems operations"
        summary="Run sync and channel actions in the rail, then verify worker state, allowlist state, and audit in the main pane."
        actions={(
          <>
            <Link href="/admin/" className="button button--secondary button--small">Back to hub</Link>
            <Link href="/" className="button button--secondary button--small">Open homepage</Link>
          </>
        )}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {message ? <Banner message={message.text} variant={message.variant} /> : null}
      {setupWarning ? <Banner message={setupWarning} variant="warning" /> : null}
      {data.alerts.map((alert) => (
        <Banner key={alert.id} message={`${alert.title}. ${alert.detail}`} variant={alert.variant} />
      ))}

      <AdminStatStrip
        items={[
          { label: 'Wise Old Man links', value: String(data.wom.linkedUsers) },
          { label: 'Public channels', value: String(selectedChannelIds.length) },
          { label: 'Public mode', value: publicModeLabel(data.discord.publicMode) },
          { label: 'Worker health', value: formatWorkerHealth(data.discord.worker.health) },
        ]}
      />

      <AdminWorkspace
        rail={(
          <>
            <AdminRailSection
              eyebrow="Sync"
              title="Refresh Wise Old Man"
              description="Clear cached clan and competition state."
              id="systems-wom"
            >
              <AdminKeyValueList
                items={[
                  ['Configured', data.wom.configured ? 'Yes' : 'No'],
                  ['Linked users', String(data.wom.linkedUsers)],
                ]}
              />
              <button
                type="button"
                className="button"
                disabled={busyAction === 'wom' || !data.wom.configured}
                onClick={() => void handleRefreshWom()}
              >
                {busyAction === 'wom' ? 'Refreshing...' : 'Refresh Wise Old Man'}
              </button>
            </AdminRailSection>

            <AdminRailSection
              eyebrow="Channels"
              title="Public channels"
              description="Choose which voice and stage channels can appear publicly."
              id="discord-presence"
            >
              <div className={styles.inlineMetaRow}>
                <span className={styles.metaToken}>{selectedChannelIds.length} selected</span>
                <span className={styles.metaToken}>{data.discord.channels.length} available</span>
              </div>
              {data.discord.channels.length ? (
                <div className={styles.selectionList}>
                  {data.discord.channels.map((channel) => (
                    <label key={channel.id} className={styles.selectionRow}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(channel.id)}
                        onChange={() => toggleChannel(channel.id)}
                        disabled={busyAction === 'allowlist'}
                      />
                      <div className={styles.selectionCopy}>
                        <strong className={styles.selectionTitle}>{channel.name}</strong>
                        <p>{channel.type === 'stage' ? 'Stage channel' : 'Voice channel'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyNote}>{data.discord.channelFetchError ?? 'No Discord voice or stage channels are available yet.'}</p>
              )}
              <button
                type="button"
                className="button"
                disabled={busyAction === 'allowlist' || Boolean(data.discord.channelFetchError)}
                onClick={() => setAllowlistReview([...selectedChannelIds])}
              >
                {busyAction === 'allowlist' ? 'Saving...' : 'Save allowlist'}
              </button>

              {allowlistReview ? (
                <InlineConfirmBar
                  title="Confirm allowlist"
                  detail="This updates which live Discord channels can appear on the public surface."
                  meta={[
                    { label: 'Selected', value: String(allowlistReview.length) },
                    { label: 'Public mode', value: publicModeLabel(data.discord.publicMode) },
                  ]}
                  confirmLabel="Confirm save"
                  pendingLabel="Saving..."
                  busy={busyAction === 'allowlist'}
                  onConfirm={() => void confirmAllowlistSave(allowlistReview)}
                  onCancel={() => setAllowlistReview(null)}
                />
              ) : null}
            </AdminRailSection>
          </>
        )}
      >
        <AdminPaneSection eyebrow="Worker" title="Worker state">
          <AdminKeyValueList
            items={[
              ['Public mode', publicModeLabel(data.discord.publicMode)],
              ['Worker health', formatWorkerHealth(data.discord.worker.health)],
              ['Bot install', data.discord.worker.state?.botInstallStatus ?? 'unknown'],
              ['Runtime', data.discord.worker.state?.runtimeStatus ?? 'idle'],
              ['Last heartbeat', formatDate(data.discord.worker.state?.lastHeartbeatAt ?? null)],
              ['Last sync', formatDate(data.discord.worker.state?.lastSyncAt ?? null)],
              ['Current path', workerStatusCopy(data.discord)],
            ]}
          />
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Modules" title="Module state">
          {data.discord.worker.activeModules.length ? (
            <div className={styles.registerList}>
              {data.discord.worker.activeModules.map((module) => (
                <article key={module.key} className={styles.registerRow}>
                  <div className={styles.registerHeader}>
                    <strong className={styles.registerTitle}>{module.label}</strong>
                    <span className={styles.metaToken}>{module.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>No worker modules are configured.</p>
          )}
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Allowlist" title="Saved public channels">
          {data.discord.allowlist.length ? (
            <div className={styles.registerList}>
              {data.discord.allowlist.map((entry) => (
                <article key={entry.channelId} className={styles.registerRow}>
                  <div className={styles.registerHeader}>
                    <strong className={styles.registerTitle}>{entry.channelName}</strong>
                    <span className={styles.metaToken}>{entry.channelType}</span>
                  </div>
                  <div className={styles.registerMeta}>
                    <span>{entry.channelId}</span>
                    <span>{formatDate(entry.updatedAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.emptyNote}>No channels are public yet.</p>
          )}
        </AdminPaneSection>

        <AdminPaneSection eyebrow="Audit" title="Recent systems actions">
          <AdminAuditFeed entries={data.recentAudit} emptyMessage="No systems audit entries yet." />
        </AdminPaneSection>
      </AdminWorkspace>
    </main>
  );
}
