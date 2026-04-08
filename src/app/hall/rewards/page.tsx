'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Highlight,
  Panel,
  AppGrid,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/ui/AppUI';
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
        getJSON<ShellData>(`/api/site-shell?next=${encodeURIComponent('/hall/rewards/')}`).catch(() => null),
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
  const featuredDrop = activeDrops[0] ?? null;
  const isAuthed = authed && !!shell?.authenticated;

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}
      {resultMsg ? <Banner message={resultMsg.text} variant={resultMsg.variant} /> : null}

      {loading ? (
        <Banner message="Loading rewards..." variant="info" />
      ) : !authed ? (
        <EmptyState
          message="Sign in to view your balance, enter drops, and see your history."
          action={<Link href="/auth/login?next=%2Fhall%2Frewards%2F" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : rewards ? (
        <>
          <Highlight
            className="rewards-balance"
            title={formatPointsFull(rewards.balance)}
            copy={
              featuredDrop
                ? `${featuredDrop.title} is live right now. Use your balance while the board is open.`
                : rewards.dailyCap !== null
                  ? `${formatPointsFull(rewards.dailyRemaining)} left today of ${formatPointsFull(rewards.dailyCap)}. No live drops are open right now.`
                  : 'No daily spending cap is active on your account, and there are no live drops right now.'
            }
            actions={(
              <>
                <a href="#active-drops" className="button button--small">
                  {featuredDrop ? 'Enter live drops' : 'Check the drop board'}
                </a>
                <a href="#points-ledger" className="button button--secondary button--small">See points ledger</a>
              </>
            )}
            stage={{
              label: 'Balance and cap',
              primary: rewards.dailyCap !== null ? `${formatPointsFull(rewards.dailyRemaining)} left today` : 'No daily cap',
              secondary: featuredDrop
                ? `${featuredDrop.title} is live for ${formatPoints(featuredDrop.pointCost)} per entry.`
                : (isAuthed ? 'Keep your balance ready for the next drop.' : 'Browse mode only.'),
              chips: [
                `${activeDrops.length} active drops`,
                `${rewards.entries.length} ledger entries`,
              ],
            }}
          />

          <section id="active-drops" className={styles.activeSurface}>
            <Panel
              className="rewards-active"
              tier="primary"
              eyebrow="Start here"
              title={activeDrops.length > 0 ? 'Live drops' : 'Drop board'}
              chip={activeDrops.length > 0 ? `${activeDrops.length} live` : undefined}
              body={(
                activeDrops.length > 0 ? (
                  <div className={styles.dropList}>
                    {activeDrops.map((item) => {
                      const remainingEntries = Math.max(item.maxEntries - item.userEntries, 0);
                      return (
                        <article key={item.id} className={styles.dropCard}>
                          <div className={styles.dropCopy}>
                            <div className={styles.dropHeader}>
                              <strong>{item.title}</strong>
                              <span className="app-chip">{formatPoints(item.pointCost)} per entry</span>
                            </div>
                            {item.description ? <p className={styles.dropDescription}>{item.description}</p> : null}
                            <div className={styles.dropMeta}>
                              <span>Closes {formatDate(item.endAt)}</span>
                              <span>{item.userEntries} / {item.maxEntries} entries used</span>
                              <span>{item.requiredRole ? item.requiredRole.label : 'Linked members'}</span>
                            </div>
                          </div>
                          <div className={styles.dropAction}>
                            <button
                              className="button"
                              disabled={!item.canEnter || entering === item.id}
                              onClick={() => handleEnter(item.id)}
                            >
                              {entering === item.id ? 'Entering...' : 'Enter drop'}
                            </button>
                            <span className="app-muted">
                              {remainingEntries > 0 ? `${remainingEntries} entries left for you` : 'Entry limit reached'}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState message="No Ghosted drops are live right now. Keep your balance ready for the next board." />
                )
              )}
            />
          </section>

          <AppGrid className={styles.lowerGrid}>
            <Panel
              className="rewards-archive"
              tier="meta"
              title={otherDrops.length > 0 ? (activeDrops.length > 0 ? 'More drops' : 'Drop archive') : 'Drop archive'}
              chip={otherDrops.length > 0 ? `${otherDrops.length} scheduled or closed` : undefined}
              body={(
                otherDrops.length > 0 ? (
                  <div className={styles.archiveList}>
                    {otherDrops.map((item) => (
                      <article key={item.id} className={styles.archiveRow}>
                        <div className={styles.archiveCopy}>
                          <div className={styles.archiveHeader}>
                            <strong>{item.title}</strong>
                            <span className="app-chip">{item.status}</span>
                          </div>
                          <span>{formatPoints(item.pointCost)} per entry</span>
                        </div>
                        <span className={styles.archiveDate}>{formatDate(item.endAt)}</span>
                      </article>
                    ))}
                  </div>
                ) : giveaways.length > 0 ? (
                  <EmptyState message="Everything on the board is live right now." />
                ) : (
                  <EmptyState message="No Ghosted drops are published yet. Check Discord for announcements." />
                )
              )}
            />

            <Panel
              className="rewards-ledger"
              tier="meta"
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
          </AppGrid>
        </>
      ) : (
        <EmptyState message="Could not load rewards data." />
      )}
    </main>
  );
}
