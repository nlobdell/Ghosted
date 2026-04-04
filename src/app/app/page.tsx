'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  Highlight,
  LeaderboardTable,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatPoints, formatMaybeNumber, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { RewardsData, GiveawayItem, LeaderboardEntry } from '@/lib/types';

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
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall' }]}
        title="The Ghosted Hall"
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

          <Highlight
            eyebrow="Clan hall"
            title="The clan is here."
            copy="Competitions, drops, casino, and your clan rankings - all in one place."
            stage={{
              label: 'Hall pulse',
              primary: featuredComp ? featuredComp.title : `${ongoingComps.length} live competitions`,
              secondary: hiscores[0]?.player?.displayName
                ? `Top hiscore: ${hiscores[0].player.displayName}`
                : `Balance: ${rewards ? formatPoints(rewards.balance) : '-'}`,
              chips: [
                womClan?.group?.name ?? GHOSTED_CONTENT.wom.clanChat,
                `${womClan?.group?.memberCount ?? GHOSTED_CONTENT.wom.memberCount} members`,
                activeDrops.length > 0
                  ? `${activeDrops.length} drop${activeDrops.length !== 1 ? 's' : ''} live`
                  : 'No active drops',
              ],
            }}
            actions={(
              <>
                <Link href="/app/clan/" className="button button--secondary button--small">Clan</Link>
                <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
              </>
            )}
          />

          <AppGrid>
            <Panel
              tier="primary"
              eyebrow="Clan"
              title={featuredComp ? featuredComp.title : 'Clan records'}
              body={(
                <div className="app-stack">
                  {featuredComp ? (
                    <div className="data-row">
                      <span className="label">{ongoingComps.length > 0 ? 'Live now' : 'Coming up'}</span>
                      <strong>{ongoingComps.length > 0 ? `${ongoingComps.length} active` : `${upcomingComps.length} upcoming`}</strong>
                    </div>
                  ) : null}
                  {hiscores.length > 0 ? (
                    <LeaderboardTable
                      entries={hiscores}
                      valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                      valueLabel="Level"
                    />
                  ) : (
                    <div className="data-row">
                      <span className="label">Members</span>
                      <strong>{womClan?.group?.memberCount ?? '-'}</strong>
                    </div>
                  )}
                  <div className="app-inline-actions">
                    <Link href="/app/clan/" className="button button--secondary button--small">Full clan</Link>
                    <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
                  </div>
                </div>
              )}
            />

            <Panel
              tier="primary"
              eyebrow="Economy"
              title={
                activeDrops.length > 0
                  ? `${activeDrops.length} active drop${activeDrops.length !== 1 ? 's' : ''}`
                  : 'Rewards and drops'
              }
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
                    {activeDrops[0] ? (
                      <div className="data-row">
                        <span className="label">{activeDrops[0].title}</span>
                        <span>{activeDrops[0].pointCost > 0 ? `${activeDrops[0].pointCost.toLocaleString()} pts` : 'Free'}</span>
                      </div>
                    ) : null}
                    <div className="app-inline-actions">
                      <Link href="/app/rewards/" className="button button--secondary button--small">Rewards</Link>
                      <Link href="/app/casino/" className="button button--secondary button--small">Casino</Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    message="Sign in to see your balance and enter drops."
                    action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>}
                  />
                )
              }
            />
          </AppGrid>

          <AppGrid>
            <Panel
              tier="meta"
              eyebrow="Your account"
              title="Status"
              body={
                authed && rewards ? (
                  <div className="app-stack">
                    <div>
                      <div className="data-row"><span className="label">Balance</span><strong>{formatPoints(rewards.balance)}</strong></div>
                      <div className="data-row"><span className="label">Ledger entries</span><strong>{rewards.entries.length}</strong></div>
                    </div>
                    <Link href="/app/profile/" className="button button--secondary button--small">Profile</Link>
                  </div>
                ) : (
                  <EmptyState
                    message="Sign in with Discord to load your profile."
                    action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>}
                  />
                )
              }
            />

            <Panel
              tier="meta"
              eyebrow="Navigate"
              title="Sections"
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
