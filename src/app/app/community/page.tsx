'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight,
  LeaderboardTable, EmptyState, Banner, CompetitionList, CONTAINER, APP_SHELL,
} from '@/components/app/AppUI';
import { formatMaybeNumber, getJSON } from '@/lib/api';
import type { ClanData, Competition, LeaderboardEntry } from '@/lib/types';

export default function DashboardPage() {
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
          getJSON<{ competitions?: Competition[] }>('/api/wom/competitions?limit=6').then((d) => d.competitions ?? []).catch(() => [] as Competition[]),
          getJSON<{ hiscores?: LeaderboardEntry[] }>('/api/wom/hiscores?metric=overall&limit=6').then((d) => d.hiscores ?? []).catch(() => [] as LeaderboardEntry[]),
          getJSON<{ gains?: LeaderboardEntry[] }>('/api/wom/gains?metric=overall&period=week&limit=6').then((d) => d.gains ?? []).catch(() => [] as LeaderboardEntry[]),
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
      <main id="main-content" style={{ ...CONTAINER, ...APP_SHELL }}>
        <AppContext
          breadcrumbs={[
            { label: 'Ghosted', href: '/' },
            { label: 'App Hub', href: '/app/' },
            { label: 'Community' },
          ]}
          title="Community overview"
        />
        <EmptyState
          message="Wise Old Man integration is not configured. Set up WOM to see clan data."
          action={<Link href="/app/" className="button button--secondary button--small">Back to hub</Link>}
        />
      </main>
    );
  }

  const ongoing = competitions.filter((c) => c.status === 'ongoing');
  const upcoming = competitions.filter((c) => c.status === 'upcoming');

  return (
    <main id="main-content" style={{ ...CONTAINER, ...APP_SHELL }}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Community' },
        ]}
        title="Community overview"
        actions={
          <>
            <Link href="/app/clan/" className="button button--secondary button--small">Clan detail</Link>
            <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
          </>
        }
      />

      {error && <Banner message={error} variant="error" />}

      {loading ? (
        <Banner message="Loading community data…" variant="info" />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Group members', value: clan ? String(clan.group.memberCount) : '—', href: '/app/clan/' },
              { label: 'Linked users', value: clan ? String(clan.linkCoverage.linkedUsers) : '—' },
              { label: 'Live competitions', value: String(ongoing.length), href: '/app/competitions/' },
              { label: 'Upcoming', value: String(upcoming.length), href: '/app/competitions/' },
            ]}
          />

          <Highlight
            theme="community"
            eyebrow="Clan watch"
            title={clan?.group.name ?? 'Ghosted clan'}
            copy={clan?.group.description ?? 'Track clan members, hiscores, and competitions.'}
            actions={
              <>
                <Link href="/app/clan/" className="button button--secondary button--small">Clan detail</Link>
                <Link href="/app/competitions/" className="button button--secondary button--small">Competitions</Link>
              </>
            }
          />

          <AppGrid>
            <Panel
              title="Clan pulse"
              eyebrow="Group overview"
              body={
                clan ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    {[
                      ['Members', String(clan.group.memberCount)],
                      ['Verified', clan.group.verified ? 'Yes' : 'No'],
                      ['Linked users', String(clan.linkCoverage.linkedUsers)],
                      ['Maxed total', String(clan.statistics.maxedTotalCount)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#9d96ad' }}>{label}</span>
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
        </>
      )}
    </main>
  );
}
