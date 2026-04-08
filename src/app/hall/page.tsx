import Link from 'next/link';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
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
  const nextRoutes = personalReady && rewards && companion
    ? [
      {
        href: '/hall/ghostling/',
        label: 'Shape your Ghostling',
        meta: `${companion.equippedCount}/4 slots equipped and ${companion.ownedCount} unlocks owned`,
        featured: true,
      },
      {
        href: '/hall/rewards/',
        label: activeDrops > 0 ? 'Enter active drops' : 'Check your balance',
        meta: `${formatPoints(rewards.balance)} ready${activeDrops > 0 ? ` across ${activeDrops} live drops` : ' for the next unlock'}`,
      },
      {
        href: '/hall/competitions/',
        label: featuredComp ? 'Watch the live board' : 'Scan upcoming competitions',
        meta: featuredComp ? featuredComp.title : `${ongoingComps.length} live and ${upcomingComps.length} upcoming`,
      },
      {
        href: '/hall/clan/',
        label: 'Read the clan pulse',
        meta: `${clan?.memberCount ?? '-'} tracked members and the current leaderboard pace`,
      },
    ]
    : [
      {
        href: '/auth/login?next=%2Fhall%2F',
        label: 'Enter the Hall with Discord',
        meta: 'Load your Ghostling, points balance, and member state.',
        featured: true,
      },
      {
        href: '/hall/ghostling/',
        label: 'Preview the Ghostling studio',
        meta: 'See your Ghostling studio before you sign in.',
      },
      {
        href: '/hall/rewards/',
        label: 'Browse the rewards loop',
        meta: `${activeDrops} drops live on the board right now.`,
      },
      {
        href: '/hall/clan/',
        label: 'Check the clan pulse',
        meta: `${clan?.memberCount ?? '-'} members tracked in the current snapshot.`,
      },
    ];
  const spotlightPrimaryRoute = nextRoutes[0];
  const spotlightSecondaryRoute = nextRoutes[1] ?? nextRoutes[0];

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
          message="Sign in with Discord to load your Ghostling, balance, and Hall view."
          variant="info"
        />
      ) : null}

      <section className={styles.spotlight}>
        <div className={styles.spotlightCopy}>
          <p className="kicker">Entered the Hall</p>
          <h1 className={styles.spotlightTitle}>
            {ghostlingReady && companion
              ? `${companion.user.displayName}, your Hall start is live.`
              : 'The Hall turns clan activity into your next move.'}
          </h1>
          <p className={styles.spotlightText}>
            {personalReady && rewards && companion
              ? `Check your Ghostling, spend ${formatPoints(rewards.balance)} on live drops, then head into competitions and the clan board.`
              : 'Sign in to load your Ghostling, sync your balance, and see a Hall view built around you.'}
          </p>
          <div className={styles.spotlightActions}>
            <Link href={spotlightPrimaryRoute.href} className="button button--small">
              {spotlightPrimaryRoute.label}
            </Link>
            <Link href={spotlightSecondaryRoute.href} className="button button--secondary button--small">
              {spotlightSecondaryRoute.label}
            </Link>
          </div>

          <div className={styles.loopGrid}>
            <article className={styles.loopCard}>
              <span>Loadout</span>
              <strong>{ghostlingReady && companion ? `${companion.equippedCount}/4 slots equipped` : 'Default preview active'}</strong>
            </article>
            <article className={styles.loopCard}>
              <span>Rewards</span>
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
            <AnimatedCompanionStage
              manifest={companion?.renderManifest}
              fallbackSrc={companion?.animatedRenderUrl ?? '/api/companion/render-animated'}
              alt={ghostlingReady && companion ? `${companion.user.displayName}'s Ghostling` : 'Ghosted Ghostling preview'}
              className={styles.stageImage}
              targetSize={232}
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
                <span className="label">Top overall</span>
                <strong>
                  {hiscores[0]
                    ? `${hiscores[0].player?.displayName || hiscores[0].player?.username || 'Ghosted member'} - ${formatMaybeNumber(hiscores[0].displayValue ?? hiscores[0].value)} total level`
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
          tier="meta"
          eyebrow="Snapshot"
          title="Leaderboard preview"
          body={(
            hiscores.length > 0 ? (
              <LeaderboardTable
                entries={hiscores}
                valueFormatter={(entry) => formatMaybeNumber(entry.displayValue ?? entry.value)}
                valueLabel="Total level"
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
          eyebrow="Recent activity"
          title="Recent rewards activity"
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
