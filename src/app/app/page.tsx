'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight, RouteList,
  LedgerTable, EmptyState, Banner,
} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import type { RewardsData, GiveawayItem } from '@/lib/types';

export default function DashboardPage() {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [womClan, setWomClan] = useState<{ group?: { name?: string; memberCount?: number } } | null>(null);
  const [competitions, setCompetitions] = useState<{ id: number; title: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rw, gv] = await Promise.all([
          getJSON<RewardsData>('/api/rewards').catch((err: Error) => {
            if (
              err.message.includes('401') ||
              err.message.toLowerCase().includes('unauthorized') ||
              err.message.toLowerCase().includes('not authenticated')
            ) {
              setAuthed(false);
              return null;
            }
            throw err;
          }),
          getJSON<{ giveaways: GiveawayItem[] }>('/api/giveaways')
            .then((data) => data.giveaways ?? [])
            .catch(() => [] as GiveawayItem[]),
        ]);

        if (rw) setRewards(rw);
        setGiveaways(gv);

        const [clan, comps] = await Promise.all([
          getJSON<{ group?: { name?: string; memberCount?: number } }>('/api/wom/clan').catch(() => null),
          getJSON<{ competitions?: { id: number; title: string; status: string }[] }>('/api/wom/competitions?limit=6')
            .then((data) => data.competitions ?? [])
            .catch(() => [] as { id: number; title: string; status: string }[]),
        ]);

        setWomClan(clan);
        setCompetitions(comps);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const activeGiveaways = giveaways.filter((item) => item.status === 'active');

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Member command center' },
        ]}
        title="Member command center"
        actions={
          <>
            <Link href="/app/community/" className="button button--secondary button--small">Community</Link>
            <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
          </>
        }
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {!authed ? <Banner message="Sign in with Discord to access your member dashboard." variant="info" /> : null}

      {loading ? (
        <Banner message="Loading dashboard..." variant="info" />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Balance', value: rewards ? formatPoints(rewards.balance) : '-', href: '/app/rewards/' },
              { label: 'Active giveaways', value: String(activeGiveaways.length), href: '/app/giveaways/' },
              { label: 'Community live', value: String(competitions.filter((item) => item.status === 'ongoing').length), href: '/app/community/' },
              { label: 'WOM link', value: womClan?.group?.name ?? 'Not configured', href: '/app/profile/' },
            ]}
          />

          <Highlight
            theme="dashboard"
            eyebrow="Command center"
            title="Ghosted member hub"
            copy="Track your balance, browse active giveaways, and monitor clan competitions from one workspace."
            actions={
              <>
                <Link href="/app/rewards/" className="button button--secondary button--small">View rewards</Link>
                <Link href="/app/giveaways/" className="button button--secondary button--small">Live drops</Link>
              </>
            }
            chips={[
              rewards ? formatPoints(rewards.balance) : 'Balance unavailable',
              `${activeGiveaways.length} active giveaways`,
            ]}
          />

          <AppGrid>
            <Panel
              title="Navigate"
              eyebrow="Quick links"
              body={
                <RouteList
                  routes={[
                    { href: '/app/community/', label: 'Community', meta: `${womClan?.group?.memberCount ?? '-'} members` },
                    { href: '/app/rewards/', label: 'Rewards', meta: rewards ? formatPoints(rewards.balance) : '-' },
                    { href: '/app/giveaways/', label: 'Giveaways', meta: `${activeGiveaways.length} active` },
                    { href: '/app/casino/', label: 'Casino', meta: 'Spin to win' },
                    { href: '/app/profile/', label: 'Profile', meta: 'Identity' },
                  ]}
                />
              }
            />

            <Panel
              title="Profile summary"
              eyebrow="Your account"
              body={
                authed && rewards ? (
                  <div className="app-stack">
                    <div>
                      <div className="data-row"><span className="label">Balance</span><strong>{formatPoints(rewards.balance)}</strong></div>
                      <div className="data-row"><span className="label">Daily remaining</span><strong>{rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap'}</strong></div>
                      <div className="data-row"><span className="label">Ledger entries</span><strong>{rewards.entries.length}</strong></div>
                    </div>
                    <Link href="/app/profile/" className="button button--secondary button--small">View profile</Link>
                  </div>
                ) : (
                  <EmptyState
                    message="Sign in to see your profile summary."
                    action={<Link href="/api/auth/discord" className="button button--secondary button--small">Sign in</Link>}
                  />
                )
              }
            />
          </AppGrid>

          {rewards && rewards.entries.length > 0 ? (
            <Panel
              title="Recent activity"
              eyebrow="Ledger"
              chip={`${rewards.entries.length} entries`}
              body={<LedgerTable entries={rewards.entries.slice(0, 6)} />}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
