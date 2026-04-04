'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  LeaderboardTable,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatPoints, formatMaybeNumber, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { RewardsData, GiveawayItem, LeaderboardEntry } from '@/lib/types';
import styles from './page.module.css';

export default function DashboardPage() {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [womClan, setWomClan] = useState<{ group?: { name?: string; memberCount?: number } } | null>(null);
  const [competitions, setCompetitions] = useState<{ id: number; title: string; status: string }[]>([]);
  const [hiscores, setHiscores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [nextRewards, nextGiveaways] = await Promise.all([
          getJSON<RewardsData>('/api/rewards').catch((nextError: Error) => {
            if (
              nextError.message.includes('401')
              || nextError.message.toLowerCase().includes('unauthorized')
              || nextError.message.toLowerCase().includes('not authenticated')
            ) {
              setAuthed(false);
              return null;
            }
            throw nextError;
          }),
          getJSON<{ giveaways: GiveawayItem[] }>('/api/giveaways')
            .then((data) => data.giveaways ?? [])
            .catch(() => [] as GiveawayItem[]),
        ]);

        if (nextRewards) setRewards(nextRewards);
        setGiveaways(nextGiveaways);

        const [clan, comps, hiscoresData] = await Promise.all([
          getJSON<{ group?: { name?: string; memberCount?: number } }>('/api/wom/clan').catch(() => null),
          getJSON<{ competitions?: { id: number; title: string; status: string }[] }>('/api/wom/competitions?limit=6')
            .then((data) => data.competitions ?? [])
            .catch(() => []),
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=3')
            .then((data) => data.hiscores ?? [])
            .catch(() => [] as LeaderboardEntry[]),
        ]);

        setWomClan(clan);
        setCompetitions(comps);
        setHiscores(hiscoresData);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load the hall.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const activeDrops = giveaways.filter((g) => g.status === 'active');
  const ongoingComps = competitions.filter((c) => c.status === 'ongoing');
  const upcomingComps = competitions.filter((c) => c.status === 'upcoming');
  const featuredComp = ongoingComps[0] ?? upcomingComps[0] ?? null;

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall' }]}
        title="Today in Ghosted"
        actions={(
          <>
            <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">Discord</a>
            <Link href="/app/clan/" className="button button--secondary button--small">Clan</Link>
          </>
        )}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {!authed ? <Banner message="Sign in with Discord to access your member workspace." variant="info" /> : null}

      {loading ? (
        <Banner message="Loading the hall..." variant="info" />
      ) : (
        <>
          <StatStrip
            leadIndex={0}
            stats={[
              { label: 'Balance', value: rewards ? formatPoints(rewards.balance) : '-', href: '/app/rewards/' },
              { label: 'Active drops', value: String(activeDrops.length), href: '/app/rewards/' },
              { label: 'Live competitions', value: String(ongoingComps.length), href: '/app/competitions/' },
              { label: 'Clan members', value: String(womClan?.group?.memberCount ?? '-'), href: '/app/clan/' },
            ]}
          />

          <Panel
            tier="primary"
            eyebrow="Live focal"
            title={featuredComp ? featuredComp.title : 'Clan pulse'}
            chip={featuredComp ? (ongoingComps.length > 0 ? 'Live' : 'Upcoming') : undefined}
            body={(
              <div className="app-stack">
                <p className="app-panel-note">
                  {featuredComp
                    ? 'Current event context and the top leaderboard snapshot for quick decisions.'
                    : 'No live event right now. Use the clan and competition boards for latest updates.'}
                </p>
                {hiscores.length > 0 ? (
                  <LeaderboardTable
                    entries={hiscores}
                    valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                    valueLabel="Level"
                  />
                ) : (
                  <div className="data-row">
                    <span className="label">Clan members</span>
                    <strong>{womClan?.group?.memberCount ?? '-'}</strong>
                  </div>
                )}
                <div className="app-inline-actions">
                  <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
                  <Link href="/app/clan/" className="button button--secondary button--small">Clan board</Link>
                </div>
              </div>
            )}
          />

          <AppGrid>
            <Panel
              tier="primary"
              eyebrow="You"
              title="Personal actions"
              body={
                authed && rewards ? (
                  <div className="app-stack">
                    <div className="data-row">
                      <span className="label">Balance</span>
                      <strong>{formatPoints(rewards.balance)}</strong>
                    </div>
                    <div className="data-row">
                      <span className="label">Daily remaining</span>
                      <strong>{rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap'}</strong>
                    </div>
                    <div className="app-inline-actions">
                      <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
                      <Link href="/app/profile/" className="button button--secondary button--small">Profile</Link>
                      <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    message="Sign in to access personal rewards and account actions."
                    action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>}
                  />
                )
              }
            />

            <Panel
              tier="meta"
              eyebrow="Navigate"
              title="Hall sections"
              body={(
                <div className="app-route-list">
                  {[
                    { href: '/app/clan/', label: 'Clan', meta: `${womClan?.group?.memberCount ?? '-'} members` },
                    { href: '/app/competitions/', label: 'Competitions', meta: `${ongoingComps.length} live` },
                    { href: '/app/rewards/', label: 'Rewards', meta: rewards ? formatPoints(rewards.balance) : 'Sign in' },
                    { href: '/app/casino/', label: 'Casino', meta: 'Points-only slots' },
                    { href: '/app/profile/', label: 'Profile', meta: 'Discord + WOM' },
                  ].map((route) => (
                    <Link key={route.href} href={route.href} className="app-route">
                      <div className="app-route__copy"><strong>{route.label}</strong></div>
                      <span className="app-route__meta">{route.meta}</span>
                    </Link>
                  ))}
                </div>
              )}
            />
          </AppGrid>

          {rewards && rewards.entries.length > 0 ? (
            <Panel
              tier="meta"
              eyebrow="Ledger"
              title="Recent activity"
              chip={`${rewards.entries.length} entries`}
              body={<LedgerTable entries={rewards.entries.slice(0, 6)} />}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
