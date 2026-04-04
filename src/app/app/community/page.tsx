'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight, ArchitectureMap,
  LeaderboardTable, EmptyState, Banner, CompetitionList,
} from '@/components/app/AppUI';
import { formatMaybeNumber, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { ClanData, Competition, LeaderboardEntry } from '@/lib/types';

export default function CommunityPage() {
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
          getJSON<{ competitions?: Competition[] }>('/api/wom/competitions?limit=6').then((data) => data.competitions ?? []).catch(() => [] as Competition[]),
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=6').then((data) => data.hiscores ?? []).catch(() => [] as LeaderboardEntry[]),
          getJSON<{ gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=6').then((data) => data.gains ?? []).catch(() => [] as LeaderboardEntry[]),
        ]);

        if (clanData) setClan(clanData);
        setCompetitions(compsData);
        setHiscores(hiscoresData);
        setGains(gainsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load community data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (!womConfigured) {
    return (
      <main id="main-content" className="page-shell">
        <AppContext
          breadcrumbs={[
            { label: 'Ghosted', href: '/' },
            { label: 'App Hub', href: '/app/' },
            { label: 'Community' },
          ]}
          title="Ghosted community overview"
        />
        <EmptyState
          message="Wise Old Man integration is not configured. Set up WOM to load the verified Ghosted group data."
          action={<Link href="/app/" className="button button--secondary button--small">Back to hub</Link>}
        />
      </main>
    );
  }

  const ongoing = competitions.filter((item) => item.status === 'ongoing');
  const upcoming = competitions.filter((item) => item.status === 'upcoming');

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Community' },
        ]}
        title="Ghosted community overview"
        actions={
          <>
            <Link href="/app/clan/" className="button button--secondary button--small">Clan detail</Link>
            <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
          </>
        }
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading community data..." variant="info" />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Group members', value: clan ? String(clan.group.memberCount) : '-', href: '/app/clan/' },
              { label: 'Linked users', value: clan ? String(clan.linkCoverage.linkedUsers) : '-' },
              { label: 'Live competitions', value: String(ongoing.length), href: '/app/competitions/' },
              { label: 'Upcoming', value: String(upcoming.length), href: '/app/competitions/' },
            ]}
          />

          <Highlight
            theme="community"
            eyebrow="Clan watch"
            title={clan?.group.name ?? 'Ghosted clan'}
            copy={clan?.group.description ?? `Ghosted is a verified WOM group (${GHOSTED_CONTENT.wom.groupId}) focused on raids, social events, bossing, and weekly skill competitions.`}
            actions={
              <>
                <Link href="/app/clan/" className="button button--secondary button--small">Clan detail</Link>
                <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
              </>
            }
          />

          <ArchitectureMap
            title="Community guide"
            copy="Use this page to understand clan health, events, and progression activity."
            nodes={[
              {
                label: 'Pulse',
                title: 'Roster and activity',
                copy: 'Start with member totals, linked users, and live activity so you know how active the clan is right now.',
                href: '/app/community/',
                cta: 'Stay on overview',
                chips: [`${clan?.group.memberCount ?? '-'} members`, `${ongoing.length} live comps`],
              },
              {
                label: 'Records',
                title: 'Clan detail and milestones',
                copy: `Dive into deep clan records, achievements, and membership context including world ${GHOSTED_CONTENT.wom.homeworld} and clan chat ${GHOSTED_CONTENT.wom.clanChat}.`,
                href: '/app/clan/',
                cta: 'Open clan detail',
                chips: ['Group metrics', 'Recent activity'],
              },
              {
                label: 'Events',
                title: 'Competition board',
                copy: 'Track upcoming and active competitions, including recurring skill-of-the-week events announced in Discord.',
                href: '/app/competitions/',
                cta: 'Open competitions',
                chips: [`${upcoming.length} upcoming`, `${competitions.length} tracked`],
              },
            ]}
          />

          <AppGrid>
            <Panel
              title="Clan pulse"
              eyebrow="Group overview"
              body={
                clan ? (
                  <div>
                    {[
                      ['Members', String(clan.group.memberCount)],
                      ['Verified', clan.group.verified ? 'Yes' : 'No'],
                      ['Linked users', String(clan.linkCoverage.linkedUsers)],
                      ['Maxed total', String(clan.statistics.maxedTotalCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="data-row">
                        <span className="label">{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No clan data available." />
                )
              }
            />
            <Panel
              title="Competition watch"
              eyebrow="Recent competitions"
              body={<CompetitionList entries={competitions} compact />}
            />
          </AppGrid>

          <AppGrid>
            <Panel
              title="Overall leaders"
              eyebrow="Hiscores"
              body={<LeaderboardTable entries={hiscores} valueFormatter={(entry) => formatMaybeNumber(entry.value)} valueLabel="Level" />}
            />
            <Panel
              title="Weekly gains"
              eyebrow="This week"
              body={<LeaderboardTable entries={gains} valueFormatter={(entry) => `+${formatMaybeNumber(entry.gained ?? entry.progress?.gained)}`} valueLabel="XP gained" />}
            />
          </AppGrid>
        </>
      )}
    </main>
  );
}
