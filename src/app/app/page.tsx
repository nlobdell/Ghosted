'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Highlight,
  Panel,
  AppGrid,
  LeaderboardTable,
  LedgerTable,
  EmptyState,
  Banner,
  RouteList,
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
          getJSON<{ entries?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=3')
            .then((data) => data.entries ?? [])
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
        summary="See what is live, where your points stand, and your highest-value next action."
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
          <Highlight
            className="hall-spotlight"
            eyebrow="Live focus"
            title={featuredComp ? featuredComp.title : 'Clan pulse'}
            copy={
              featuredComp
                ? 'Start with the live event, then move into your rewards and current clan status.'
                : 'No live competition is active right now, so the best next move is checking your balance and the clan board.'
            }
            actions={(
              <>
                <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
                <Link href="/app/companion/" className="button button--secondary button--small">Companion</Link>
                <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
              </>
            )}
            stage={
              hiscores[0]
                ? {
                  label: 'Top hiscore',
                  primary: hiscores[0].player?.displayName || hiscores[0].player?.username || 'Ghosted member',
                  secondary: `${formatMaybeNumber(hiscores[0].value)} overall level`,
                  chips: [
                    `${ongoingComps.length} live competitions`,
                    `${womClan?.group?.memberCount ?? '-'} members`,
                  ],
                }
                : {
                  label: 'Hall status',
                  primary: `${womClan?.group?.memberCount ?? '-'} clan members`,
                  secondary: `${activeDrops.length} active drops available`,
                  chips: [`${ongoingComps.length} live competitions`],
                }
            }
          />

          <StatStrip
            className="hall-scoreboard"
            leadIndex={0}
            stats={[
              { label: 'Balance', value: rewards ? formatPoints(rewards.balance) : '-', href: '/app/rewards/' },
              { label: 'Active drops', value: String(activeDrops.length), href: '/app/rewards/' },
              { label: 'Live competitions', value: String(ongoingComps.length), href: '/app/competitions/' },
              { label: 'Clan members', value: String(womClan?.group?.memberCount ?? '-'), href: '/app/clan/' },
            ]}
          />

          <AppGrid>
            <Panel
              className="hall-actions"
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
                      <Link href="/app/companion/" className="button button--secondary button--small">Companion</Link>
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
              className="hall-nav"
              tier="meta"
              eyebrow="Navigate"
              title="Hall sections"
              body={(
                <RouteList
                  routes={[
                    { href: '/app/clan/', label: 'Clan', meta: `${womClan?.group?.memberCount ?? '-'} members` },
                    { href: '/app/competitions/', label: 'Competitions', meta: `${ongoingComps.length} live` },
                    { href: '/app/rewards/', label: 'Rewards', meta: rewards ? formatPoints(rewards.balance) : 'Sign in' },
                    { href: '/app/companion/', label: 'Companion', meta: 'Tiny avatar studio' },
                    { href: '/app/casino/', label: 'Casino', meta: 'Points-only slots' },
                    { href: '/app/profile/', label: 'Profile', meta: 'Discord + WOM' },
                  ]}
                />
              )}
            />
          </AppGrid>

          <AppGrid>
            <Panel
              className="hall-leaders"
              tier="primary"
              eyebrow="Snapshot"
              title="Leaderboard preview"
              body={
                hiscores.length > 0 ? (
                  <LeaderboardTable
                    entries={hiscores}
                    valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                    valueLabel="Level"
                  />
                ) : (
                  <EmptyState message="Leaderboard data is unavailable right now." />
                )
              }
            />
            <Panel
              className="hall-ledger"
              tier="meta"
              eyebrow="Ledger"
              title="Recent activity"
              chip={rewards ? `${rewards.entries.length} entries` : undefined}
              body={
                rewards && rewards.entries.length > 0
                  ? <LedgerTable entries={rewards.entries.slice(0, 6)} />
                  : <EmptyState message="No recent rewards activity yet." />
              }
            />
          </AppGrid>
        </>
      )}
    </main>
  );
}
