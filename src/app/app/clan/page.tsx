'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Highlight,
  Panel,
  AppGrid,
  MetricGrid,
  LeaderboardTable,
  Feed,
  CompetitionList,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type {
  ClanData,
  Competition,
  LeaderboardEntry,
  AchievementItem,
  ActivityItem,
  WomEntriesResponse,
} from '@/lib/types';
import styles from './page.module.css';

export default function ClanPage() {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [hiscores, setHiscores] = useState<LeaderboardEntry[]>([]);
  const [gains, setGains] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [womConfigured, setWomConfigured] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [clanData, compsData, hiscoresData, gainsData] = await Promise.all([
          getJSON<ClanData>('/api/wom/clan').catch((err: Error) => {
            if (err.message.toLowerCase().includes('not configured') || err.message.includes('404')) {
              setWomConfigured(false);
              return null;
            }
            throw err;
          }),
          getJSON<{ competitions?: Competition[] }>('/api/wom/competitions?limit=8')
            .then((data) => data.competitions ?? [])
            .catch(() => [] as Competition[]),
          getJSON<WomEntriesResponse | { hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=8')
            .then((data) => ('entries' in data ? data.entries : (data.hiscores ?? [])))
            .catch(() => [] as LeaderboardEntry[]),
          getJSON<WomEntriesResponse | { gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=8')
            .then((data) => ('entries' in data ? data.entries : (data.gains ?? [])))
            .catch(() => [] as LeaderboardEntry[]),
        ]);

        if (clanData) setClan(clanData);
        setCompetitions(compsData);
        setHiscores(hiscoresData);
        setGains(gainsData);
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
      <main id="main-content" className={`page-shell ${styles.page}`}>
        <AppContext
          breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall', href: '/app/' }, { label: 'Clan' }]}
          title="Ghosted clan"
        />
        <EmptyState
          message="Wise Old Man integration is not configured. Set up WOM to load verified Ghosted group data."
          action={<Link href="/app/" className="button button--secondary button--small">Back to Hall</Link>}
        />
      </main>
    );
  }

  const ongoing = competitions.filter((c) => c.status === 'ongoing');
  const upcoming = competitions.filter((c) => c.status === 'upcoming');

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall', href: '/app/' }, { label: 'Clan' }]}
        title="Clan board"
        summary="Track roster health first, then top performers, then recent activity."
        actions={<Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading clan data..." variant="info" />
      ) : clan ? (
        <>
          <Highlight
            className="clan-spotlight"
            eyebrow="Roster signal"
            title={clan.group.name}
            copy="Use this board to monitor roster health, active competition pressure, and the members setting the pace."
            actions={<Link href="/app/competitions/" className="button button--secondary button--small">View competitions</Link>}
            stage={
              hiscores[0]
                ? {
                  label: 'Top performer',
                  primary: hiscores[0].player?.displayName || hiscores[0].player?.username || 'Ghosted member',
                  secondary: `${formatMaybeNumber(hiscores[0].value)} overall level`,
                  chips: [
                    `${ongoing.length} live events`,
                    `${clan.linkCoverage.linkedUsers} linked members`,
                  ],
                }
                : {
                  label: 'Clan status',
                  primary: `${clan.group.memberCount} members`,
                  secondary: `${ongoing.length} competitions live`,
                  chips: [`${clan.linkCoverage.linkedUsers} linked users`],
                }
            }
          />

          <StatStrip
            className="clan-scoreboard"
            leadIndex={0}
            stats={[
              { label: 'Members', value: String(clan.group.memberCount) },
              { label: 'Linked', value: String(clan.linkCoverage.linkedUsers) },
              { label: 'Live competitions', value: String(ongoing.length), href: '/app/competitions/' },
              { label: 'Weekly gains tracked', value: String(gains.length) },
            ]}
          />

          <AppGrid>
            <Panel
              className="clan-roster"
              tier="primary"
              eyebrow="Roster health"
              title={clan.group.name}
              body={(
                <div className="app-stack">
                  <p className="app-panel-note">
                    Verified WOM group {GHOSTED_CONTENT.wom.groupId}. Monitor core membership health and clan identity data.
                  </p>
                  <MetricGrid
                    items={[
                      ['Members', String(clan.group.memberCount)],
                      ['Linked users', String(clan.linkCoverage.linkedUsers)],
                      ['Verified', clan.group.verified ? 'Yes' : 'No'],
                      ['Home world', String(clan.group.homeworld ?? GHOSTED_CONTENT.wom.homeworld)],
                      ['Clan chat', clan.group.clanChat ?? GHOSTED_CONTENT.wom.clanChat],
                      ['Score', clan.group.score !== undefined ? String(clan.group.score) : '-'],
                    ]}
                  />
                </div>
              )}
            />
            <Panel
              className="clan-leaders"
              tier="primary"
              eyebrow="Top performers"
              title="Overall leaders"
              body={(
                <LeaderboardTable
                  entries={hiscores}
                  valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                  valueLabel="Level"
                />
              )}
            />
          </AppGrid>

          <AppGrid>
            <Panel
              className="clan-events"
              tier="primary"
              eyebrow="Event watch"
              title={ongoing.length > 0 ? `${ongoing.length} competitions live` : `${upcoming.length} competitions upcoming`}
              body={<CompetitionList entries={competitions} compact />}
            />
            <Panel
              className="clan-gains"
              tier="primary"
              eyebrow="Progression"
              title="Weekly gains"
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
              className="clan-history"
              tier="meta"
              eyebrow="History"
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
              eyebrow="Activity"
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
          message="No clan data available. Check WOM configuration."
          action={<Link href="/app/" className="button button--secondary button--small">Back to Hall</Link>}
        />
      )}
    </main>
  );
}
