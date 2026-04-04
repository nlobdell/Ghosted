'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight,
  MetricGrid, LeaderboardTable, Feed, EmptyState, Banner, CONTAINER, APP_SHELL,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import type { ClanData, LeaderboardEntry } from '@/lib/types';

export default function DashboardPage() {
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
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=8').then((d) => d.hiscores ?? []).catch(() => [] as LeaderboardEntry[]),
          getJSON<{ gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=8').then((d) => d.gains ?? []).catch(() => [] as LeaderboardEntry[]),
        ]);
        setClan(clanData);
        setHiscores(hiscoresData);
        setGains(gainsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clan data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main id="main-content" style={{ ...CONTAINER, ...APP_SHELL }}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Community', href: '/app/community/' },
          { label: 'Clan' },
        ]}
        title="Clan detail"
        actions={
          <Link href="/app/community/" className="button button--secondary button--small">Community</Link>
        }
      />

      {error && <Banner message={error} variant="error" />}

      {loading ? (
        <Banner message="Loading clan data…" variant="info" />
      ) : clan ? (
        <>
          <StatStrip
            stats={[
              { label: 'Group members', value: String(clan.group.memberCount) },
              { label: 'Ghosted links', value: String(clan.linkCoverage.linkedUsers) },
              { label: 'Maxed totals', value: String(clan.statistics.maxedTotalCount) },
              { label: 'Avg total level', value: clan.statistics.averageOverallLevel ? String(Math.round(clan.statistics.averageOverallLevel)) : '—' },
            ]}
          />

          <AppGrid>
            <Panel
              title="Group details"
              eyebrow="Clan info"
              body={
                <MetricGrid
                  items={[
                    ['Name', clan.group.name],
                    ['Verified', clan.group.verified ? 'Yes' : 'No'],
                    ['Members', String(clan.group.memberCount)],
                    ['Score', clan.group.score !== undefined ? String(clan.group.score) : '—'],
                    ['Clan chat', clan.group.clanChat ?? '—'],
                    ['Home world', clan.group.homeworld ?? '—'],
                  ]}
                />
              }
            />
            <Panel
              title="Link coverage"
              eyebrow="WOM integration"
              body={
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
              }
            />
          </AppGrid>

          <AppGrid>
            <Panel
              title="Overall hiscores"
              eyebrow="Top players"
              body={
                <LeaderboardTable
                  entries={hiscores}
                  valueFormatter={(e) => formatMaybeNumber(e.value)}
                  valueLabel="Level"
                />
              }
            />
            <Panel
              title="Weekly gains"
              eyebrow="This week"
              body={
                <LeaderboardTable
                  entries={gains}
                  valueFormatter={(e) => `+${formatMaybeNumber(e.gained ?? e.progress?.gained)}`}
                  valueLabel="XP gained"
                />
              }
            />
          </AppGrid>

          <AppGrid>
            <Panel
              title="Recent achievements"
              eyebrow="Milestones"
              body={
                <Feed
                  items={
                    Array.isArray(clan.recentAchievements) && clan.recentAchievements.length > 0
                      ? clan.recentAchievements.slice(0, 8).map((a: unknown) => {
                          const item = a as Record<string, unknown>;
                          return {
                            title: String(item.title ?? item.type ?? 'Achievement'),
                            meta: item.createdAt ? formatDate(String(item.createdAt)) : undefined,
                            eyebrow: item.metric ? String(item.metric) : undefined,
                          };
                        })
                      : []
                  }
                />
              }
            />
            <Panel
              title="Recent activity"
              eyebrow="Activity log"
              body={
                <Feed
                  items={
                    Array.isArray(clan.recentActivity) && clan.recentActivity.length > 0
                      ? clan.recentActivity.slice(0, 8).map((a: unknown) => {
                          const item = a as Record<string, unknown>;
                          return {
                            title: String(item.title ?? item.type ?? 'Activity'),
                            meta: item.createdAt ? formatDate(String(item.createdAt)) : undefined,
                            eyebrow: item.type ? String(item.type) : undefined,
                          };
                        })
                      : []
                  }
                />
              }
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
