'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  Highlight,
  MetricGrid,
  LeaderboardTable,
  Feed,
  CompetitionList,
  EmptyState,
  Banner,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { ClanData, Competition, LeaderboardEntry, AchievementItem, ActivityItem } from '@/lib/types';

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
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=8')
            .then((data) => data.hiscores ?? [])
            .catch(() => [] as LeaderboardEntry[]),
          getJSON<{ gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=8')
            .then((data) => data.gains ?? [])
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
      <main id="main-content" className="page-shell">
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
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[{ label: 'Ghosted', href: '/' }, { label: 'Hall', href: '/app/' }, { label: 'Clan' }]}
        title="Ghosted clan"
        actions={
          <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
        }
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading clan data..." variant="info" />
      ) : clan ? (
        <>
          <StatStrip
            leadIndex={0}
            stats={[
              { label: 'Members', value: String(clan.group.memberCount) },
              { label: 'Linked', value: String(clan.linkCoverage.linkedUsers) },
              { label: 'Live competitions', value: String(ongoing.length), href: '/app/competitions/' },
              { label: 'Weekly gains tracked', value: String(gains.length) },
            ]}
          />

          <Highlight
            eyebrow="Clan"
            title={clan.group.name}
            copy={
              clan.group.description ??
              `Verified WOM group ${GHOSTED_CONTENT.wom.groupId}. Focused on raids, bossing, and weekly skill events. Home world ${GHOSTED_CONTENT.wom.homeworld}, clan chat ${GHOSTED_CONTENT.wom.clanChat}.`
            }
            stage={{
              label: 'Clan signal',
              primary: hiscores[0]?.player?.displayName
                ? `Top player: ${hiscores[0].player.displayName}`
                : `${clan.group.memberCount} members`,
              secondary: ongoing.length > 0
                ? `${ongoing.length} competition${ongoing.length !== 1 ? 's' : ''} live`
                : `${upcoming.length} upcoming`,
              chips: [
                `${clan.group.memberCount} members`,
                `${clan.linkCoverage.linkedUsers} linked`,
              ],
            }}
            actions={
              <Link href="/app/competitions/" className="button button--secondary button--small">
                Competitions
              </Link>
            }
          />

          {/* Roster + Active events side by side */}
          <AppGrid>
            <Panel
              tier="primary"
              eyebrow="Roster"
              title="Group details"
              body={
                <MetricGrid
                  items={[
                    ['Name', clan.group.name],
                    ['Verified', clan.group.verified ? 'Yes' : 'No'],
                    ['Members', String(clan.group.memberCount)],
                    ['Score', clan.group.score !== undefined ? String(clan.group.score) : '-'],
                    ['Clan chat', clan.group.clanChat ?? GHOSTED_CONTENT.wom.clanChat],
                    ['Home world', String(clan.group.homeworld ?? GHOSTED_CONTENT.wom.homeworld)],
                  ]}
                />
              }
            />
            <Panel
              tier="primary"
              eyebrow="Events"
              title="Competition watch"
              body={<CompetitionList entries={competitions} compact />}
            />
          </AppGrid>

          {/* Hiscores + Weekly gains */}
          <AppGrid>
            <Panel
              tier="primary"
              eyebrow="Hiscores"
              title="Overall leaders"
              body={
                <LeaderboardTable
                  entries={hiscores}
                  valueFormatter={(entry) => formatMaybeNumber(entry.value)}
                  valueLabel="Level"
                />
              }
            />
            <Panel
              tier="primary"
              eyebrow="This week"
              title="Weekly gains"
              body={
                <LeaderboardTable
                  entries={gains}
                  valueFormatter={(entry) => `+${formatMaybeNumber(entry.gained ?? entry.progress?.gained)}`}
                  valueLabel="XP gained"
                />
              }
            />
          </AppGrid>

          {/* Achievements + Activity */}
          <AppGrid>
            <Panel
              tier="meta"
              eyebrow="Milestones"
              title="Recent achievements"
              body={
                <Feed
                  items={clan.recentAchievements.slice(0, 6).map((a: AchievementItem) => ({
                    title: a.title ?? a.type ?? 'Achievement',
                    meta: a.createdAt ? formatDate(a.createdAt) : undefined,
                    eyebrow: a.metric,
                  }))}
                />
              }
            />
            <Panel
              tier="meta"
              eyebrow="Activity"
              title="Recent activity"
              body={
                <Feed
                  items={clan.recentActivity.slice(0, 6).map((a: ActivityItem) => ({
                    title: a.title ?? a.type ?? 'Activity',
                    meta: a.createdAt ? formatDate(a.createdAt) : undefined,
                    eyebrow: a.type,
                  }))}
                />
              }
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
