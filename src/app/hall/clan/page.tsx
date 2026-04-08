'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  StatStrip,
  Highlight,
  Panel,
  AppGrid,
  MetricGrid,
  LeaderboardTable,
  Feed,
  EmptyState,
  Banner,
} from '@/components/ui/AppUI';
import { formatDate, formatMaybeNumber, formatMetricLabel, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type {
  AchievementItem,
  ActivityItem,
  ClanData,
  LeaderboardEntry,
} from '@/lib/types';
import styles from './page.module.css';

function leaderboardValue(entry?: LeaderboardEntry | null) {
  return entry?.displayValue ?? entry?.progress?.gained ?? entry?.gained ?? entry?.value;
}

export default function ClanPage() {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [womConfigured, setWomConfigured] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const clanData = await getJSON<ClanData>('/api/wom/clan').catch((err: Error) => {
          if (err.message.toLowerCase().includes('not configured') || err.message.includes('404')) {
            setWomConfigured(false);
            return null;
          }
          throw err;
        });

        if (clanData) setClan(clanData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clan data.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (!womConfigured) {
    return (
      <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
        <EmptyState
          message="Wise Old Man integration is not configured. Set it up to load verified Ghosted group data."
          action={<Link href="/hall/" className="button button--secondary button--small">Back to Hall</Link>}
        />
      </main>
    );
  }

  const leaderboardEntries = clan?.featuredHiscores?.entries ?? [];
  const gainsEntries = clan?.featuredGains?.entries ?? [];
  const topLeader = leaderboardEntries[0];
  const topGainer = gainsEntries[0];
  const skillOfTheWeek = clan?.skillOfTheWeek ?? null;
  const skillBoardEntries = skillOfTheWeek?.standings ?? [];
  const skillBoardLeader = skillBoardEntries[0];
  const skillBoardTitle = skillOfTheWeek?.competition.displayTitle ?? skillOfTheWeek?.competition.title ?? 'Skill of the Week';
  const skillBoardTracked = skillOfTheWeek?.competition.participantCount ?? skillBoardEntries.length;
  const skillBoardModeLabel = skillOfTheWeek?.mode === 'latest_finished' ? 'Latest finished board' : 'Live now';
  const trackedMembers = clan?.linkCoverage.trackedUsers ?? 0;
  const linkedMembers = clan?.linkCoverage.linkedUsers ?? 0;
  const groupMemberCount = clan?.linkCoverage.groupMemberCount ?? clan?.group.memberCount ?? 0;
  const unlinkedMembers = clan?.linkCoverage.unlinkedUsers ?? Math.max(groupMemberCount - linkedMembers, 0);
  const linkRate = groupMemberCount > 0 ? `${Math.round((linkedMembers / groupMemberCount) * 100)}%` : '-';

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading clan data..." variant="info" />
      ) : clan ? (
        <>
          <Highlight
            className="clan-spotlight"
            title={clan.group.name}
            copy={
              skillOfTheWeek
                ? 'Start with roster health, then check the live competition pace across Ghosted.'
                : 'Start with roster health, then compare the overall leaders with the latest weekly gains across Ghosted.'
            }
            actions={(
              <>
                <a href="#roster-health" className="button button--small">Review roster health</a>
                <a href="#clan-competition-signal" className="button button--secondary button--small">Check clan pace</a>
              </>
            )}
            stage={
              skillOfTheWeek && skillBoardLeader
                ? {
                  label: skillOfTheWeek.mode === 'latest_finished' ? 'Last Skill of the Week' : 'Skill of the Week',
                  primary: skillBoardTitle,
                  secondary: `${skillBoardLeader.player?.displayName || skillBoardLeader.player?.username || 'Ghosted member'} leads with +${formatMaybeNumber(leaderboardValue(skillBoardLeader))}`,
                  chips: [
                    skillBoardModeLabel,
                    `${formatMaybeNumber(skillBoardTracked)} tracked`,
                    `${linkRate} linked coverage`,
                  ],
                }
                : topLeader
                  ? {
                    label: 'Top performer',
                    primary: topLeader.player?.displayName || topLeader.player?.username || 'Ghosted member',
                    secondary: `${formatMaybeNumber(leaderboardValue(topLeader))} overall level`,
                    chips: [
                      skillOfTheWeek ? skillBoardModeLabel : 'No recent Skill of the Week',
                      `${linkRate} linked coverage`,
                    ],
                  }
                  : {
                    label: 'Clan status',
                    primary: `${clan.group.memberCount} members`,
                    secondary: skillOfTheWeek ? skillBoardTitle : 'No recent Skill of the Week board',
                    chips: [`${linkRate} linked coverage`],
                  }
            }
          />

          <AppGrid className={styles.primaryGrid}>
            <Panel
              className="clan-roster"
              tier="primary"
              eyebrow="Start here"
              title="Roster health"
              body={(
                <div id="roster-health" className="app-stack">
                  <p className="app-panel-note">
                    Verified Wise Old Man group {GHOSTED_CONTENT.wom.groupId}. Check membership coverage, linked accounts, and home-world details here first.
                  </p>
                  <MetricGrid
                    items={[
                      ['Members', String(clan.group.memberCount)],
                      ['Tracked users', String(trackedMembers)],
                      ['Linked users', String(linkedMembers)],
                      ['Unlinked users', String(unlinkedMembers)],
                      ['Coverage', linkRate],
                      ['Home world', String(clan.group.homeworld ?? GHOSTED_CONTENT.wom.homeworld)],
                      ['Clan chat', clan.group.clanChat ?? GHOSTED_CONTENT.wom.clanChat],
                      ['Avg overall', formatMaybeNumber(clan.statistics.averageOverallLevel)],
                      ['Maxed total', String(clan.statistics.maxedTotalCount)],
                    ]}
                  />
                </div>
              )}
            />
            <Panel
              className="clan-events"
              tier="meta"
              eyebrow="Live board"
              title="Board snapshot"
              body={(
                <div id="clan-competition-signal" className="app-stack">
                  <p className="app-panel-note">
                    {skillOfTheWeek
                      ? `${skillOfTheWeek.mode === 'active' ? 'Wise Old Man is currently tracking' : 'The latest finished Wise Old Man board tracked'} ${formatMetricLabel(skillOfTheWeek.competition.metric)}. Use this snapshot to check the pace and compare it with the overall leaders below.`
                      : 'Wise Old Man is not showing a recent Skill of the Week board right now. Use the overall leaders and weekly gain pace to keep tabs on the clan.'}
                  </p>
                  <MetricGrid
                    items={[
                      ['Board', skillOfTheWeek ? skillBoardTitle : 'No recent board'],
                      ['Status', skillOfTheWeek ? skillBoardModeLabel : 'Unavailable'],
                      ['Metric', skillOfTheWeek ? formatMetricLabel(skillOfTheWeek.competition.metric) : 'Overall'],
                      ['Tracked', skillOfTheWeek ? String(skillBoardTracked) : '-'],
                      ['Leader', skillBoardLeader?.player?.displayName || skillBoardLeader?.player?.username || '-'],
                      ['Leader gain', skillBoardLeader ? `+${formatMaybeNumber(leaderboardValue(skillBoardLeader))}` : '-'],
                      ['Weekly pace leader', topGainer?.player?.displayName || topGainer?.player?.username || '-'],
                      ['Weekly pace', topGainer ? `+${formatMaybeNumber(leaderboardValue(topGainer))}` : '-'],
                    ]}
                  />
                </div>
              )}
            />
          </AppGrid>

          <StatStrip
            className="clan-scoreboard"
            leadIndex={0}
            stats={[
              { label: 'Members', value: String(clan.group.memberCount) },
              { label: 'Linked coverage', value: linkRate },
              { label: 'Tracked users', value: String(trackedMembers), href: '/hall/clan/' },
              { label: 'Maxed total', value: String(clan.statistics.maxedTotalCount) },
            ]}
          />

          <AppGrid className={styles.secondaryGrid}>
            <Panel
              className="clan-leaders"
              tier="meta"
              title="Skill of the Week standings"
              chip={skillOfTheWeek ? skillBoardModeLabel : undefined}
              body={(
                skillBoardEntries.length > 0 ? (
                  <LeaderboardTable
                    entries={skillBoardEntries}
                    valueFormatter={(entry) => `+${formatMaybeNumber(leaderboardValue(entry))}`}
                    valueLabel="XP gained"
                  />
                ) : (
                  <EmptyState message="No Skill of the Week standings are available yet." />
                )
              )}
            />
            <Panel
              className="clan-gains"
              tier="meta"
              title="Overall leaders"
              body={(
                <LeaderboardTable
                  entries={leaderboardEntries}
                  valueFormatter={(entry) => formatMaybeNumber(leaderboardValue(entry))}
                  valueLabel="Total level"
                />
              )}
            />
          </AppGrid>

          <AppGrid className={styles.archiveGrid}>
            <Panel
              className="clan-history"
              tier="meta"
              title="Recent achievements"
              body={(
                <Feed
                  items={clan.recentAchievements.slice(0, 6).map((a: AchievementItem) => ({
                    title: a.title ?? a.type ?? 'Achievement',
                    meta: a.createdAt ? formatDate(a.createdAt) : undefined,
                    eyebrow: a.metric,
                  }))}
                />
              )}
            />
            <Panel
              className="clan-activity"
              tier="meta"
              title="Recent clan activity"
              body={(
                <Feed
                  items={clan.recentActivity.slice(0, 6).map((a: ActivityItem) => ({
                    title: a.title ?? a.type ?? 'Activity',
                    meta: a.createdAt ? formatDate(a.createdAt) : undefined,
                    eyebrow: a.type,
                  }))}
                />
              )}
            />
          </AppGrid>
        </>
      ) : (
        <EmptyState
          message="No clan data available. Check Wise Old Man configuration."
          action={<Link href="/hall/" className="button button--secondary button--small">Back to Hall</Link>}
        />
      )}
    </main>
  );
}
