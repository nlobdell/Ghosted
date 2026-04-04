'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  Highlight,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatPoints, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
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
        const [nextRewards, nextGiveaways] = await Promise.all([
          getJSON<RewardsData>('/api/rewards').catch((nextError: Error) => {
            if (
              nextError.message.includes('401') ||
              nextError.message.toLowerCase().includes('unauthorized') ||
              nextError.message.toLowerCase().includes('not authenticated')
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

        const [clan, comps] = await Promise.all([
          getJSON<{ group?: { name?: string; memberCount?: number } }>('/api/wom/clan').catch(() => null),
          getJSON<{ competitions?: { id: number; title: string; status: string }[] }>('/api/wom/competitions?limit=6')
            .then((data) => data.competitions ?? [])
            .catch(() => [] as { id: number; title: string; status: string }[]),
        ]);

        setWomClan(clan);
        setCompetitions(comps);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load the hall.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const activeGiveaways = giveaways.filter((item) => item.status === 'active');
  const ongoingComps = competitions.filter((item) => item.status === 'ongoing');
  const upcomingComps = competitions.filter((item) => item.status === 'upcoming');
  const featuredComp = ongoingComps[0] ?? upcomingComps[0] ?? null;

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'The Hall', href: '/app/' },
        ]}
        title="The Ghosted Hall"
        actions={
          <>
            <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">Discord</a>
            <Link href="/app/community/" className="button button--secondary button--small">Community</Link>
          </>
        }
      />

      {error ? <Banner message={error} variant="error" /> : null}
      {!authed ? <Banner message="Sign in with Discord to access your member workspace." variant="info" /> : null}

      {loading ? (
        <Banner message="Loading the hall..." variant="info" />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Balance', value: rewards ? formatPoints(rewards.balance) : '-', href: '/app/rewards/' },
              { label: 'Active giveaways', value: String(activeGiveaways.length), href: '/app/giveaways/' },
              { label: 'Live competitions', value: String(ongoingComps.length), href: '/app/competitions/' },
              { label: 'Clan members', value: String(womClan?.group?.memberCount ?? '-'), href: '/app/community/' },
            ]}
          />

          <Highlight
            theme="dashboard"
            eyebrow="Clan hall"
            title="The clan is here."
            copy="Competitions, drops, casino, and your clan rankings — all in one place."
            chips={[
              womClan?.group?.name ?? GHOSTED_CONTENT.wom.clanChat,
              `${womClan?.group?.memberCount ?? GHOSTED_CONTENT.wom.memberCount} members`,
              activeGiveaways.length > 0
                ? `${activeGiveaways.length} giveaway${activeGiveaways.length !== 1 ? 's' : ''} live`
                : 'No active giveaways',
            ]}
            actions={
              <>
                <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
                <Link href="/app/giveaways/" className="button button--secondary button--small">Giveaways</Link>
              </>
            }
          />

          {/* Community pulse — what's happening right now */}
          <section className="app-pulse-grid">
            {/* Featured active or upcoming event */}
            <Panel
              eyebrow={ongoingComps.length > 0 ? 'Live now' : upcomingComps.length > 0 ? 'Coming up' : 'Clan'}
              title={
                featuredComp
                  ? featuredComp.title
                  : ongoingComps.length === 0
                  ? 'No competitions running'
                  : 'Clan activity'
              }
              body={
                <div className="app-stack">
                  {ongoingComps.length > 0 ? (
                    <>
                      <div className="data-row">
                        <span className="label">Active races</span>
                        <strong>{ongoingComps.length}</strong>
                      </div>
                      {upcomingComps.length > 0 && (
                        <div className="data-row">
                          <span className="label">Upcoming</span>
                          <strong>{upcomingComps.length}</strong>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="app-panel-note">
                      Check back soon — competitions run weekly.
                    </p>
                  )}
                  <div className="data-row">
                    <span className="label">Clan members</span>
                    <strong>{womClan?.group?.memberCount ?? '-'}</strong>
                  </div>
                  <div className="app-inline-actions">
                    <Link href="/app/competitions/" className="button button--secondary button--small">
                      {ongoingComps.length > 0 ? 'View live races' : 'View competitions'}
                    </Link>
                    <Link href="/app/community/" className="button button--secondary button--small">Community</Link>
                  </div>
                </div>
              }
            />

            {/* Economy: balance and active drops */}
            <Panel
              eyebrow="Economy"
              title={
                activeGiveaways.length > 0
                  ? `${activeGiveaways.length} active drop${activeGiveaways.length !== 1 ? 's' : ''}`
                  : 'Rewards and drops'
              }
              body={
                authed && rewards ? (
                  <div className="app-stack">
                    <div className="data-row">
                      <span className="label">Your balance</span>
                      <strong>{formatPoints(rewards.balance)}</strong>
                    </div>
                    <div className="data-row">
                      <span className="label">Daily remaining</span>
                      <strong>
                        {rewards.dailyCap !== null ? formatPoints(rewards.dailyRemaining) : 'No cap'}
                      </strong>
                    </div>
                    {activeGiveaways.length > 0 ? (
                      <div className="data-row">
                        <span className="label">{activeGiveaways[0].title}</span>
                        <span>{activeGiveaways[0].pointCost > 0 ? `${activeGiveaways[0].pointCost.toLocaleString()} pts` : 'Free'}</span>
                      </div>
                    ) : null}
                    <div className="app-inline-actions">
                      <Link href="/app/giveaways/" className="button button--secondary button--small">Giveaways</Link>
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
          </section>

          <AppGrid>
            <Panel
              title="Sections"
              eyebrow="Where to go"
              body={
                <div className="app-route-list">
                  {[
                    { href: '/app/community/', label: 'Community', meta: `${womClan?.group?.memberCount ?? '-'} members` },
                    { href: '/app/competitions/', label: 'Competitions', meta: `${ongoingComps.length} active` },
                    { href: '/app/rewards/', label: 'Rewards', meta: rewards ? formatPoints(rewards.balance) : '-' },
                    { href: '/app/giveaways/', label: 'Giveaways', meta: `${activeGiveaways.length} live` },
                    { href: '/app/casino/', label: 'Casino', meta: 'Points-only slots' },
                    { href: '/app/profile/', label: 'Profile', meta: 'Discord + WOM' },
                  ].map((route) => (
                    <Link key={route.href} href={route.href} className="app-route">
                      <div className="app-route__copy"><strong>{route.label}</strong></div>
                      <span className="app-route__meta">{route.meta}</span>
                    </Link>
                  ))}
                </div>
              }
            />

            <Panel
              title="Your status"
              eyebrow="Account"
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
                    message="Sign in with Discord to load your member profile."
                    action={<Link href="/auth/discord/login" className="button button--secondary button--small">Sign in</Link>}
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
