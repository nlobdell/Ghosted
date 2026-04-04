'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  ArchitectureMap,
  Highlight,
  MetricGrid,
  LeaderboardTable,
  Feed,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { ClanData, LeaderboardEntry, AchievementItem, ActivityItem } from '@/lib/types';

export default function ClanPage() {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [hiscores, setHiscores] = useState<LeaderboardEntry[]>([]);
  const [gains, setGains] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [clanData, hiscoresData, gainsData] = await Promise.all([
          getJSON<ClanData>('/api/wom/clan'),
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=8')
            .then((data) => data.hiscores ?? [])
            .catch(() => [] as LeaderboardEntry[]),
          getJSON<{ gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=8')
            .then((data) => data.gains ?? [])
            .catch(() => [] as LeaderboardEntry[]),
        ]);
        setClan(clanData);
        setHiscores(hiscoresData);
        setGains(gainsData);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load clan data.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Community', href: '/app/community/' },
          { label: 'Clan' },
        ]}
        title="Ghosted clan detail"
        actions={<Link href="/app/community/" className="button button--secondary button--small">Community</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading clan data..." variant="info" />
      ) : clan ? (
        <>
          <StatStrip
            stats={[
              { label: 'Group members', value: String(clan.group.memberCount) },
              { label: 'Ghosted links', value: String(clan.linkCoverage.linkedUsers) },
              { label: 'Maxed totals', value: String(clan.statistics.maxedTotalCount) },
              {
                label: 'Avg total level',
                value: clan.statistics.averageOverallLevel
                  ? String(Math.round(clan.statistics.averageOverallLevel))
                  : '-',
              },
            ]}
          />

          <Highlight
            theme="community"
            eyebrow="Clan detail"
            title={clan.group.name}
            copy={`A full Ghosted snapshot with member metrics, top performers, and recent activity from WOM Group ${GHOSTED_CONTENT.wom.groupId}.`}
            actions={
              <Link href="/app/competitions/" className="button button--secondary button--small">
                Competitions
              </Link>
            }
            chips={[
              `${clan.group.memberCount} members`,
              `${clan.linkCoverage.linkedUsers} linked`,
            ]}
          />

          <ArchitectureMap
            title="What this page tells members"
            copy="Use this page to understand clan health, top performers, and current momentum."
            nodes={[
              {
                label: 'Health',
                title: 'Roster and core stats',
                copy: 'Member count, verification status, and link coverage show how healthy and connected the clan is.',
                chips: [`${clan.group.memberCount} members`, `World ${clan.group.homeworld ?? GHOSTED_CONTENT.wom.homeworld}`],
              },
              {
                label: 'Performance',
                title: 'Hiscores and gains',
                copy: 'Hiscores and weekly gains highlight who is currently pushing progression in skill and bossing cycles.',
                href: '/app/competitions/',
                cta: 'Open competitions',
                chips: [`${hiscores.length} hiscore entries`, `${gains.length} gain entries`],
              },
              {
                label: 'Momentum',
                title: 'Recent activity',
                copy: 'Recent achievements and feed activity show what the clan is accomplishing right now.',
                chips: [
                  `${clan.recentAchievements.length} achievements`,
                  `${clan.recentActivity.length} activity events`,
                ],
              },
            ]}
          />

          <AppGrid>
            <Panel
              title="Group details"
              eyebrow="Clan info"
              body={(
                <MetricGrid
                  items={[
                    ['Name', clan.group.name],
                    ['Verified', clan.group.verified ? 'Yes' : 'No'],
                    ['Members', String(clan.group.memberCount)],
                    ['Score', clan.group.score !== undefined ? String(clan.group.score) : '-'],
                    ['Clan chat', clan.group.clanChat ?? '-'],
                    ['Home world', clan.group.homeworld ?? '-'],
                  ]}
                />
              )}
            />
            <Panel
              title="Link coverage"
              eyebrow="WOM integration"
              body={(
                <MetricGrid
                  items={[
                    ['Tracked users', String(clan.linkCoverage.trackedUsers)],
                    ['Linked', String(clan.linkCoverage.linkedUsers)],
                    ['Unlinked', String(clan.linkCoverage.unlinkedUsers)],
                    ['Group members', String(clan.linkCoverage.groupMemberCount)],
                    ['Maxed combat', String(clan.statistics.maxedCombatCount)],
                    ['Maxed 200ms', String(clan.statistics.maxed200msCount)],
                  ]}
                />
              )}
            />
          </AppGrid>

          <AppGrid>
            <Panel
              title="Overall hiscores"
              eyebrow="Top players"
              body={(
                <LeaderboardTable
                  entries={hiscores}
                  valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                  valueLabel="Level"
                />
              )}
            />
            <Panel
              title="Weekly gains"
              eyebrow="This week"
              body={(
                <LeaderboardTable
                  entries={gains}
                  valueFormatter={(entry) => `+${formatMaybeNumber(entry.gained ?? entry.progress?.gained)}`}
                  valueLabel="XP gained"
                />
              )}
            />
          </AppGrid>

          <AppGrid>
            <Panel
              title="Recent achievements"
              eyebrow="Milestones"
              body={(
                <Feed
                  items={clan.recentAchievements.slice(0, 8).map((achievement: AchievementItem) => ({
                    title: achievement.title ?? achievement.type ?? 'Achievement',
                    meta: achievement.createdAt ? formatDate(achievement.createdAt) : undefined,
                    eyebrow: achievement.metric,
                  }))}
                />
              )}
            />
            <Panel
              title="Recent activity"
              eyebrow="Activity log"
              body={(
                <Feed
                  items={clan.recentActivity.slice(0, 8).map((activity: ActivityItem) => ({
                    title: activity.title ?? activity.type ?? 'Activity',
                    meta: activity.createdAt ? formatDate(activity.createdAt) : undefined,
                    eyebrow: activity.type,
                  }))}
                />
              )}
            />
          </AppGrid>
        </>
      ) : (
        <EmptyState
          message="No clan data available. Check your WOM configuration."
          action={<Link href="/app/community/" className="button button--secondary button--small">Back to Community</Link>}
        />
      )}
    </main>
  );
}
