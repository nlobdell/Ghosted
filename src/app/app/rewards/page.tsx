'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Highlight,
  Panel,
  AppGrid,
  MetricGrid,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatPoints, formatPointsFull, formatDate, getJSON } from '@/lib/api';
import type { RewardsData, GiveawayItem, ShellData } from '@/lib/types';
import styles from './page.module.css';

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [shell, setShell] = useState<ShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);
  const [resultMsg, setResultMsg] = useState<{ text: string; variant: 'info' | 'error' } | null>(null);
  const [entering, setEntering] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [rewardsData, giveawaysData, shellData] = await Promise.all([
        getJSON<RewardsData>('/api/rewards').catch((err: Error) => {
          if (
            err.message.includes('401')
            || err.message.toLowerCase().includes('unauthorized')
            || err.message.toLowerCase().includes('not authenticated')
          ) {
            setAuthed(false);
            return null;
          }
          throw err;
        }),
        getJSON<{ giveaways: GiveawayItem[] }>('/api/giveaways')
          .then((data) => {
            const sorted = [...(data.giveaways ?? [])].sort((a, b) => {
              const rank = (s: string) => (s === 'active' ? 0 : s === 'scheduled' ? 1 : 2);
              return rank(a.status) - rank(b.status) || String(a.endAt || '').localeCompare(String(b.endAt || ''));
            });
            return sorted;
          })
          .catch(() => [] as GiveawayItem[]),
        getJSON<ShellData>(`/api/site-shell?next=${encodeURIComponent('/app/rewards/')}`).catch(() => null),
      ]);

      if (rewardsData) setRewards(rewardsData);
      setGiveaways(giveawaysData);
      if (shellData) setShell(shellData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEnter = async (id: number) => {
    setEntering(id);
    setResultMsg(null);
    try {
      const result = await getJSON<{ result: { balance: number; entriesRemaining: number } }>(
        `/api/giveaways/${id}/enter`,
        { method: 'POST' },
      );
      setResultMsg({
        text: `Entry added. ${formatPoints(result.result.balance)} left, ${result.result.entriesRemaining} entries remaining.`,
        variant: 'info',
      });
      await load();
    } catch (err) {
      setResultMsg({ text: err instanceof Error ? err.message : 'Unable to enter giveaway.', variant: 'error' });
    } finally {
      setEntering(null);
    }
  };

  const activeDrops = giveaways.filter((g) => g.status === 'active');
  const otherDrops = giveaways.filter((g) => g.status !== 'active');
  const isAuthed = authed && !!shell?.authenticated;

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall', href: '/app/' }, { label: 'Rewards' }]}
        title="Rewards and drops"
        summary="Confirm available balance first, then spend on active drops, then review ledger history."
        actions={<Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {resultMsg ? <Banner message={resultMsg.text} variant={resultMsg.variant} /> : null}

      {loading ? (
        <Banner message="Loading rewards..." variant="info" />
      ) : !authed ? (
        <EmptyState
          message="Sign in to view your balance, enter drops, and see your history."
          action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : rewards ? (
        <>
          <StatStrip
            className="rewards-scoreboard"
            leadIndex={0}
            stats={[
              { label: 'Balance', value: formatPoints(rewards.balance) },
              { label: 'Daily remaining', value: rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap' },
              { label: 'Active drops', value: String(activeDrops.length) },
              { label: 'Ledger entries', value: String(rewards.entries.length) },
            ]}
          />

          <Highlight
            className="rewards-balance"
            eyebrow="Economy"
            title={formatPointsFull(rewards.balance)}
            copy={
              rewards.dailyCap !== null
                ? `${formatPointsFull(rewards.dailyRemaining)} remaining today out of ${formatPointsFull(rewards.dailyCap)}.`
                : 'No daily spending cap is active on your account.'
            }
            actions={(
              <>
                <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
                <Link href="/app/profile/" className="button button--secondary button--small">Profile</Link>
              </>
            )}
            stage={{
              label: 'Drop signal',
              primary: activeDrops.length > 0 ? `${activeDrops.length} active drops` : 'No active drops',
              secondary: isAuthed ? 'Entry enabled for linked members.' : 'Browse mode only.',
              chips: [
                `${rewards.entries.length} ledger entries`,
                rewards.dailyCap !== null ? `${formatPoints(rewards.dailyRemaining)} left today` : 'No daily cap',
              ],
            }}
          />

          {activeDrops.length > 0 ? (
            <AppGrid>
              {activeDrops.map((item) => (
                <Panel
                  className="rewards-drop"
                  tier="primary"
                  key={item.id}
                  eyebrow="Active drop"
                  title={item.title}
                  chip={item.status}
                  body={(
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
                          {entering === item.id ? 'Entering...' : 'Enter drop'}
                        </button>
                      </div>
                    </div>
                  )}
                />
              ))}
            </AppGrid>
          ) : null}

          {otherDrops.length > 0 ? (
            <Panel
              className="rewards-archive"
              tier="meta"
              eyebrow="Archive"
              title={activeDrops.length > 0 ? 'Upcoming and closed' : 'All drops'}
              chip={`${giveaways.length} total`}
              body={(
                <div className="app-route-list">
                  {otherDrops.map((item) => (
                    <div key={item.id} className="app-route" style={{ cursor: 'default' }}>
                      <div className="app-route__copy">
                        <strong>{item.title}</strong>
                        <span className="app-chip" style={{ marginTop: '0.2rem' }}>{item.status}</span>
                      </div>
                      <span className="app-route__meta">{formatDate(item.endAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            />
          ) : null}

          {giveaways.length === 0 ? (
            <Panel
              className="rewards-empty"
              tier="meta"
              eyebrow="Drops"
              title="No giveaways yet"
              body={<EmptyState message="No Ghosted drops are published yet. Check Discord for announcements." />}
            />
          ) : null}

          <Panel
            className="rewards-ledger"
            tier="meta"
            eyebrow="History"
            title="Points ledger"
            chip={`${rewards.entries.length} entries`}
            body={
              rewards.entries.length > 0 ? (
                <LedgerTable entries={rewards.entries} />
              ) : (
                <EmptyState message="No ledger activity yet. Earn points by participating in the community." />
              )
            }
          />
        </>
      ) : (
        <EmptyState message="Could not load rewards data." />
      )}
    </main>
  );
}
