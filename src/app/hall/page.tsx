/* eslint-disable @next/next/no-img-element -- Ghostling preview uses the animated SVG endpoint directly for motion parity across the site. */
import Link from 'next/link';
import {
  StatStrip,
  Panel,
  AppGrid,
  LeaderboardTable,
  LedgerTable,
  EmptyState,
  Banner,
} from '@/components/ui/AppUI';
import { formatPoints, formatMaybeNumber } from '@/lib/api';
import { getHallDashboardData } from '@/lib/server/hall-data';
import styles from './page.module.css';

export default async function DashboardPage() {
  const dashboard = await getHallDashboardData();

  if (!dashboard) {
    return (
      <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
        <Banner message="The hall could not load right now." variant="error" />
      </main>
    );
  }

  const { authenticated, error, rewards, companion, giveaways, clan, competitions, hiscores } = dashboard;
  const activeDrops = giveaways.activeCount;
  const ongoingComps = competitions.filter((competition) => competition.status === 'ongoing');
  const upcomingComps = competitions.filter((competition) => competition.status === 'upcoming');
  const featuredComp = ongoingComps[0] ?? upcomingComps[0] ?? null;
  const ghostlingReady = authenticated && Boolean(companion);
  const personalReady = authenticated && Boolean(rewards && companion);

  const scoreboardStats = personalReady && rewards && companion
    ? [
      { label: 'Balance', value: formatPoints(rewards.balance), href: '/hall/rewards/' },
      { label: 'Unlocked', value: String(companion.ownedCount), href: '/hall/ghostling/' },
      { label: 'Active drops', value: String(activeDrops), href: '/hall/rewards/' },
      { label: 'Live competitions', value: String(ongoingComps.length), href: '/hall/competitions/' },
    ]
    : [
      { label: 'Clan members', value: String(clan?.memberCount ?? '-'), href: '/hall/clan/' },
      { label: 'Active drops', value: String(activeDrops), href: '/hall/rewards/' },
      { label: 'Live competitions', value: String(ongoingComps.length), href: '/hall/competitions/' },
      { label: 'Ghostling', value: 'Preview ready', href: '/hall/ghostling/' },
    ];

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}
      {!authenticated ? (
        <Banner
          message="Sign in with Discord to load your Ghostling, points balance, and personal hall actions."
          variant="info"
        />
      ) : null}

      <section className={styles.spotlight}>
        <div className={styles.spotlightCopy}>
          <p className="kicker">Entered the Hall</p>
          <h1 className={styles.spotlightTitle}>
            {ghostlingReady && companion
              ? `${companion.user.displayName}'s Ghostling is ready to lead the room.`
              : 'The Hall turns the public pulse into a personal workspace.'}
          </h1>
          <p className={styles.spotlightText}>
            {personalReady && rewards && companion
              ? `You have ${formatPoints(rewards.balance)} ready for cosmetics, drops, and the rest of the Ghosted loop. Start with the Ghostling, then fan out into rewards, casino, and live clan events.`
              : 'Sign in to load your own Ghostling, sync your balance, and replace the public overview with a member-specific starting point.'}
          </p>
          <p className={styles.transitionNote}>
            The public layer gives you the signal. The Hall keeps the same world, but narrows it down to what you can do next.
          </p>

          <div className={styles.loopGrid}>
            <article className={styles.loopCard}>
              <span>Loadout</span>
              <strong>{ghostlingReady && companion ? `${companion.equippedCount}/4 slots equipped` : 'Default preview active'}</strong>
            </article>
            <article className={styles.loopCard}>
              <span>Economy</span>
              <strong>{ghostlingReady && companion ? `${companion.ownedCount} unlocks owned` : `${activeDrops} active drops waiting`}</strong>
            </article>
            <article className={styles.loopCard}>
              <span>Live hall</span>
              <strong>{featuredComp ? featuredComp.title : `${ongoingComps.length} competitions live`}</strong>
            </article>
          </div>
        </div>

        <aside className={styles.spotlightStage}>
          <div className={styles.stageFrame}>
            <img
              src={companion?.animatedRenderUrl ?? '/api/companion/render-animated'}
              alt={ghostlingReady && companion ? `${companion.user.displayName}'s Ghostling` : 'Ghosted Ghostling preview'}
              className={styles.stageImage}
            />
          </div>
          <div className={styles.stageMeta}>
            <strong>{ghostlingReady && companion ? companion.user.displayName : 'Ghosted Ghostling'}</strong>
            <span>{ghostlingReady && companion ? `@${companion.user.username}` : 'Default Ghostling until sign-in'}</span>
          </div>
        </aside>
      </section>

      <StatStrip
        className={`hall-scoreboard ${styles.scoreboard}`}
        leadIndex={0}
        stats={scoreboardStats}
      />

      <section className={styles.primarySection}>
        <Panel
          className="hall-actions"
          tier="primary"
          eyebrow="Points loop"
          title="What to do next"
          body={(
            personalReady && rewards && companion ? (
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
              </div>
            ) : authenticated ? (
              <EmptyState message="Your personal hall data is unavailable right now. Try refreshing the hall in a moment." />
            ) : (
              <EmptyState
                message="Sign in to access your Ghostling loadout, points balance, and personal hall actions."
                action={<Link href="/auth/login?next=%2Fhall%2F" className="button button--secondary button--small">Sign in</Link>}
              />
            )
          )}
        />
      </section>

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
                <strong>{clan?.memberCount ?? '-'}</strong>
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
                <strong>{activeDrops}</strong>
              </div>
            </div>
          )}
        />

        <Panel
          className="hall-leaders"
          tier="primary"
          eyebrow="Snapshot"
          title="Leaderboard preview"
          body={(
            hiscores.length > 0 ? (
              <LeaderboardTable
                entries={hiscores}
                valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                valueLabel="Level"
              />
            ) : (
              <EmptyState message="Leaderboard data is unavailable right now." />
            )
          )}
        />
      </AppGrid>

      <section className={styles.ledgerShell}>
        <Panel
          className="hall-ledger"
          tier="meta"
          eyebrow="Ledger"
          title="Recent activity"
          chip={rewards ? `${rewards.entries.length} entries` : undefined}
          body={(
            rewards && rewards.entries.length > 0
              ? <LedgerTable entries={rewards.entries.slice(0, 6)} />
              : <EmptyState message="No recent rewards activity yet." />
          )}
        />
      </section>
    </main>
  );
}
