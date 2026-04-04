'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight,
  MetricGrid, EmptyState, Banner,
} from '@/components/app/AppUI';
import { formatPoints, formatDate, getJSON } from '@/lib/api';
import type { GiveawayItem, ShellData } from '@/lib/types';

export default function GiveawaysPage() {
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [shell, setShell] = useState<ShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [entering, setEntering] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [payload, sh] = await Promise.all([
        getJSON<{ giveaways: GiveawayItem[] }>('/api/giveaways'),
        getJSON<ShellData>(`/api/site-shell?next=${encodeURIComponent(window.location.pathname)}`),
      ]);

      const sorted = [...(payload.giveaways ?? [])].sort((left, right) => {
        const rank = (status: string) => (status === 'active' ? 0 : status === 'scheduled' ? 1 : 2);
        return rank(left.status) - rank(right.status) || String(left.endAt || '').localeCompare(String(right.endAt || ''));
      });

      setGiveaways(sorted);
      setShell(sh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load giveaways.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnter = async (id: number) => {
    setEntering(id);
    setResultMsg(null);

    try {
      const result = await getJSON<{ result: { balance: number; entriesRemaining: number } }>(`/api/giveaways/${id}/enter`, { method: 'POST' });
      setResultMsg({
        text: `Entry added. ${formatPoints(result.result.balance)} left with ${result.result.entriesRemaining} entries remaining.`,
        variant: 'info',
      });
      await load();
    } catch (err) {
      setResultMsg({ text: err instanceof Error ? err.message : 'Unable to enter giveaway.', variant: 'error' });
    } finally {
      setEntering(null);
    }
  };

  const activeCount = giveaways.filter((item) => item.status === 'active').length;
  const authed = !!shell?.authenticated;

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Giveaways' },
        ]}
        title="Live drops"
        actions={
          <>
            <Link href="/app/rewards/" className="button button--secondary button--small">Check Balance</Link>
            <Link href="/app/profile/" className="button button--secondary button--small">Review Roles</Link>
          </>
        }
      />

      {loading ? <Banner message="Loading giveaways..." variant="info" /> : null}
      {error ? <Banner message={error} variant="error" /> : null}
      {resultMsg ? <Banner message={resultMsg.text} variant={resultMsg.variant} /> : null}

      {!loading && !error ? (
        <>
          <StatStrip
            stats={[
              { label: 'Active now', value: String(activeCount), href: '/app/giveaways/' },
              { label: 'Total giveaways', value: String(giveaways.length), href: '/app/giveaways/' },
              { label: 'Entry type', value: 'Points + roles' },
              { label: 'Sign-in', value: authed ? 'Ready' : 'Browse only', href: '/app/profile/' },
            ]}
          />

          <Highlight
            eyebrow="Giveaways"
            title="Live drops first."
            copy="Active entries stay on top with cost and access visible."
            chips={[`${activeCount} active`, authed ? 'Member entry enabled' : 'Browse mode']}
            theme="giveaways"
          />

          <AppGrid>
            {giveaways.length === 0 ? (
              <Panel title="No giveaways yet" body={<EmptyState message="Ghosted has not published any giveaways yet." />} />
            ) : (
              giveaways.map((item) => (
                <Panel
                  key={item.id}
                  title={item.title}
                  chip={item.status}
                  body={
                    <div className="app-stack">
                      {item.description ? <p className="app-panel-note">{item.description}</p> : null}
                      <MetricGrid
                        items={[
                          ['Cost', formatPoints(item.pointCost)],
                          ['Entries', `${item.userEntries} / ${item.maxEntries}`],
                          ['Closes', formatDate(item.endAt)],
                          ['Access', item.requiredRole ? item.requiredRole.label : 'Linked members'],
                        ]}
                      />
                      <div className="app-inline-actions">
                        <button
                          className="button"
                          disabled={!item.canEnter || entering === item.id}
                          onClick={() => handleEnter(item.id)}
                        >
                          {entering === item.id ? 'Entering...' : 'Enter'}
                        </button>
                      </div>
                    </div>
                  }
                />
              ))
            )}
          </AppGrid>
        </>
      ) : null}
    </main>
  );
}
