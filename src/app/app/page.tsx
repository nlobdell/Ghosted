'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import {
  AppContext,
  StatStrip,
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
import type {
  CompanionData,
  GiveawayItem,
  LeaderboardEntry,
  RewardsData,
  WomEntriesResponse,
} from '@/lib/types';
import styles from './page.module.css';

function isAuthError(error: Error) {
  const message = error.message.toLowerCase();
  return (
    error.message.includes('401')
    || message.includes('unauthorized')
    || message.includes('not authenticated')
    || message.includes('please sign in')
  );
}

export default function DashboardPage() {
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [companion, setCompanion] = useState<CompanionData | null>(null);
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
        const fetchAuthed = async <T,>(path: string) => {
          try {
            return await getJSON<T>(path);
          } catch (nextError) {
            if (nextError instanceof Error && isAuthError(nextError)) {
              setAuthed(false);
              return null;
            }
            throw nextError;
          }
        };

        const [nextRewards, nextCompanion, nextGiveaways] = await Promise.all([
          fetchAuthed<RewardsData>('/api/rewards'),
          fetchAuthed<CompanionData>('/api/companion'),
          getJSON<{ giveaways: GiveawayItem[] }>('/api/giveaways')
            .then((data) => data.giveaways ?? [])
            .catch(() => [] as GiveawayItem[]),
        ]);

        if (nextRewards) setRewards(nextRewards);
        if (nextCompanion) setCompanion(nextCompanion);
        setGiveaways(nextGiveaways);

        const [clan, comps, hiscoresData] = await Promise.all([
          getJSON<{ group?: { name?: string; memberCount?: number } }>('/api/wom/clan').catch(() => null),
          getJSON<{ competitions?: { id: number; title: string; status: string }[] }>('/api/wom/competitions?limit=6')
            .then((data) => data.competitions ?? [])
            .catch(() => []),
          getJSON<WomEntriesResponse | { hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=3')
            .then((data) => ('entries' in data ? data.entries : (data.hiscores ?? [])))
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
  const companionReady = authed && Boolean(companion);

  const scoreboardStats = companionReady && companion
    ? [
      { label: 'Balance', value: formatPoints(companion.balance), href: '/app/rewards/' },
      { label: 'Unlocked', value: String(companion.ownedCount), href: '/app/companion/' },
      { label: 'Active drops', value: String(activeDrops.length), href: '/app/rewards/' },
      { label: 'Live competitions', value: String(ongoingComps.length), href: '/app/competitions/' },
    ]
    : [
      { label: 'Clan members', value: String(womClan?.group?.memberCount ?? '-'), href: '/app/clan/' },
      { label: 'Active drops', value: String(activeDrops.length), href: '/app/rewards/' },
      { label: 'Live competitions', value: String(ongoingComps.length), href: '/app/competitions/' },
      { label: 'Ghostling', value: 'Preview ready', href: '/app/companion/' },
    ];

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall' }]}
        title="Today in Ghosted"
        summary="Start with your Ghostling, then move into the points loop, live competitions, and the wider clan pulse."
        actions={(
          <>
            <Link href="/app/companion/" className="button button--secondary button--small">Ghostling</Link>
            <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">Discord</a>
          </>
        )}
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {!authed ? <Banner message="Sign in with Discord to load your Ghostling, points balance, and personal hall actions." variant="info" /> : null}

      {loading ? (
        <Banner message="Loading the hall..." variant="info" />
      ) : (
        <>
          <section className={styles.spotlight}>
            <div className={styles.spotlightCopy}>
              <p className="kicker">Ghostling-first hall</p>
              <h2 className={styles.spotlightTitle}>
                {companionReady && companion
                  ? `${companion.user.displayName}'s Ghostling is ready to lead the hall.`
                  : 'Lead with your Ghostling, then move through everything else.'}
              </h2>
              <p className={styles.spotlightText}>
                {companionReady && companion
                  ? `You have ${formatPoints(companion.balance)} ready for cosmetics, drops, and the rest of the Ghosted loop. Tune the loadout first, then branch into rewards, casino, and live clan events.`
                  : 'Sign in to load your own Ghostling, sync your balance, and turn the hall into a personal starting point instead of a generic overview.'}
              </p>

              <div className="app-inline-actions">
                <Link href="/app/companion/" className="button button--secondary button--small">Open Ghostling</Link>
                <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
                <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
                {!companionReady ? (
                  <Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>
                ) : null}
              </div>

              <div className={styles.loopGrid}>
                <article className={styles.loopCard}>
                  <span>Loadout</span>
                  <strong>{companionReady && companion ? `${companion.equippedCount}/4 slots equipped` : 'Default preview active'}</strong>
                </article>
                <article className={styles.loopCard}>
                  <span>Economy</span>
                  <strong>{companionReady && companion ? `${companion.ownedCount} unlocks owned` : `${activeDrops.length} active drops waiting`}</strong>
                </article>
                <article className={styles.loopCard}>
                  <span>Live hall</span>
                  <strong>{featuredComp ? featuredComp.title : `${ongoingComps.length} competitions live`}</strong>
                </article>
              </div>
            </div>

            <aside className={styles.spotlightStage}>
              <div className={styles.stageFrame}>
                <AnimatedCompanionStage
                  manifest={companion?.renderManifest}
                  fallbackSrc={companion?.renderUrl ?? '/api/companion/render'}
                  alt={companionReady && companion ? `${companion.user.displayName}'s Ghostling` : 'Ghosted Ghostling preview'}
                  className={styles.stageImage}
                />
              </div>
              <div className={styles.stageMeta}>
                <strong>{companionReady && companion ? companion.user.displayName : 'Ghosted Ghostling'}</strong>
                <span>{companionReady && companion ? `@${companion.user.username}` : 'Default Ghostling until sign-in'}</span>
              </div>
            </aside>
          </section>

          <StatStrip
            className={`hall-scoreboard ${styles.scoreboard}`}
            leadIndex={0}
            stats={scoreboardStats}
          />

          <AppGrid className={styles.primaryGrid}>
            <Panel
              className="hall-actions"
              tier="primary"
              eyebrow="Points loop"
              title="What to do next"
              body={(
                companionReady && rewards && companion ? (
                  <div className="app-stack">
                    <div className="data-row">
                      <span className="label">Current balance</span>
                      <strong>{formatPoints(rewards.balance)}</strong>
                    </div>
                    <div className="data-row">
                      <span className="label">Daily remaining</span>
                      <strong>{rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap'}</strong>
                    </div>
                    <div className="data-row">
                      <span className="label">Ghostling unlocks</span>
                      <strong>{companion.ownedCount} owned</strong>
                    </div>
                    <div className="app-inline-actions">
                      <Link href="/app/companion/" className="button button--secondary button--small">Ghostling studio</Link>
                      <Link href="/app/rewards/" className="button button--secondary button--small">Spend points</Link>
                      <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
                      <Link href="/app/profile/" className="button button--secondary button--small">Profile</Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    message="Sign in to access your Ghostling loadout, points balance, and personal hall actions."
                    action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>}
                  />
                )
              )}
            />

            <Panel
              className="hall-nav"
              tier="meta"
              eyebrow="Navigate"
              title="Move through the hall"
              body={(
                <RouteList
                  routes={[
                    {
                      href: '/app/companion/',
                      label: 'Ghostling',
                      meta: companionReady && companion ? `${companion.ownedCount} unlocks, ${companion.equippedCount}/4 equipped` : 'Ghostling setup + export',
                    },
                    { href: '/app/rewards/', label: 'Rewards', meta: rewards ? formatPoints(rewards.balance) : 'Drops + ledger' },
                    { href: '/app/casino/', label: 'Casino', meta: 'Points-only slots' },
                    { href: '/app/competitions/', label: 'Competitions', meta: `${ongoingComps.length} live` },
                    { href: '/app/clan/', label: 'Clan', meta: `${womClan?.group?.memberCount ?? '-'} members` },
                    { href: '/app/profile/', label: 'Profile', meta: 'Discord + WOM' },
                  ]}
                />
              )}
            />
          </AppGrid>

          <AppGrid className={styles.secondaryGrid}>
            <Panel
              className="hall-pulse"
              tier="meta"
              eyebrow="Live hall"
              title={featuredComp ? featuredComp.title : 'Clan pulse'}
              body={(
                <div className="app-stack">
                  <div className="data-row">
                    <span className="label">Featured event</span>
                    <strong>{featuredComp ? featuredComp.title : 'No live competition right now'}</strong>
                  </div>
                  <div className="data-row">
                    <span className="label">Clan members</span>
                    <strong>{womClan?.group?.memberCount ?? '-'}</strong>
                  </div>
                  <div className="data-row">
                    <span className="label">Top hiscore</span>
                    <strong>
                      {hiscores[0]
                        ? `${hiscores[0].player?.displayName || hiscores[0].player?.username || 'Ghosted member'} - ${formatMaybeNumber(hiscores[0].value)}`
                        : 'Unavailable'}
                    </strong>
                  </div>
                  <div className="data-row">
                    <span className="label">Active drops</span>
                    <strong>{activeDrops.length}</strong>
                  </div>
                  <div className="app-inline-actions">
                    <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
                    <Link href="/app/clan/" className="button button--secondary button--small">Clan</Link>
                    <Link href="/app/rewards/" className="button button--secondary button--small">Giveaways</Link>
                  </div>
                </div>
              )}
            />

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
          </AppGrid>

          <section className={styles.ledgerShell}>
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
          </section>
        </>
      )}
    </main>
  );
}
