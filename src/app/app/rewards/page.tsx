'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, Highlight,
  LedgerTable, EmptyState, Banner,
} from '@/components/app/AppUI';
import { formatPoints, formatPointsFull, getJSON } from '@/lib/api';
import type { RewardsData } from '@/lib/types';

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getJSON<RewardsData>('/api/rewards');
        setRewards(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load rewards.';
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('not authenticated')) {
          setAuthed(false);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Rewards' },
        ]}
        title="Balance & ledger"
        actions={
          <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
        }
      />

      {error && <Banner message={error} variant="error" />}

      {loading ? (
        <Banner message="Loading rewards…" variant="info" />
      ) : !authed ? (
        <EmptyState
          message="Sign in to view your balance and rewards history."
          action={<Link href="/api/auth/discord" className="button button--secondary button--small">Sign in with Discord</Link>}
        />
      ) : rewards ? (
        <>
          <StatStrip
            stats={[
              { label: 'Balance', value: formatPoints(rewards.balance) },
              { label: 'Daily remaining', value: rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap' },
              { label: 'Recent spins', value: String(Array.isArray(rewards.spins) ? rewards.spins.length : 0) },
              { label: 'Ledger entries', value: String(rewards.entries.length) },
            ]}
          />

          <Highlight
            theme="rewards"
            eyebrow="Balance rail"
            title={formatPointsFull(rewards.balance)}
            copy={
              rewards.dailyCap !== null
                ? `You have ${formatPointsFull(rewards.dailyRemaining)} remaining today out of a ${formatPointsFull(rewards.dailyCap)} daily cap.`
                : 'No daily spending cap is currently active on your account.'
            }
            actions={
              <>
                <Link href="/app/casino/" className="button button--secondary button--small">Visit casino</Link>
                <Link href="/app/giveaways/" className="button button--secondary button--small">Giveaways</Link>
              </>
            }
          />

          <Panel
            title="Ledger"
            eyebrow="All activity"
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
