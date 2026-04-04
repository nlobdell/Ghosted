'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight, ArchitectureMap,
  CompetitionList, MetricGrid, LeaderboardTable, EmptyState, Banner,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import type { Competition, LeaderboardEntry } from '@/lib/types';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [featured, setFeatured] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const compsData = await getJSON<{ competitions?: Competition[] }>('/api/wom/competitions?limit=12').then((data) => data.competitions ?? []);
        setCompetitions(compsData);

        if (compsData.length > 0) {
          const first = compsData[0];
          const detail = await getJSON<Competition>(`/api/wom/competitions/${first.id}`).catch(() => null);
          if (detail) setFeatured(detail);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load competitions.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const ongoing = competitions.filter((item) => item.status === 'ongoing');
  const upcoming = competitions.filter((item) => item.status === 'upcoming');
  const finished = competitions.filter((item) => item.status === 'finished');

  return (
    <main id="main-content" className="page-shell">
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'App Hub', href: '/app/' },
          { label: 'Community', href: '/app/community/' },
          { label: 'Competitions' },
        ]}
        title="Competition board"
        actions={<Link href="/app/community/" className="button button--secondary button--small">Community</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading competitions..." variant="info" />
      ) : (
        <>
          <StatStrip
            stats={[
              { label: 'Tracked comps', value: String(competitions.length) },
              { label: 'Ongoing', value: String(ongoing.length) },
              { label: 'Upcoming', value: String(upcoming.length) },
              { label: 'Finished', value: String(finished.length) },
            ]}
          />

          <Highlight
            theme="community"
            eyebrow="Competition board"
            title="Track Ghosted events and races."
            copy="Ghosted commonly runs skill-of-the-week competitions. Use this board to monitor timing, participation, and results."
            chips={[
              `${ongoing.length} ongoing`,
              `${upcoming.length} upcoming`,
            ]}
          />

          <ArchitectureMap
            title="Competition guide"
            copy="This page helps members understand what is running now and what usually runs next."
            nodes={[
              {
                label: 'Now',
                title: 'Current and upcoming events',
                copy: 'Track all competitions in one place with clear status for ongoing, upcoming, and finished events.',
                chips: [`${ongoing.length} ongoing`, `${finished.length} finished`],
              },
              {
                label: 'Format',
                title: 'Event details',
                copy: 'Each event shows metric, format, duration, and participant data so members know exactly what is being measured.',
                chips: [
                  featured?.metric ?? 'No metric',
                  featured?.participants ? `${featured.participants.length} participants` : 'No participants',
                ],
              },
              {
                label: 'Examples',
                title: 'Typical Ghosted events',
                copy: 'Recent examples include recurring skill-of-the-week competitions coordinated through Discord.',
                href: '/app/community/',
                cta: 'Open community',
                chips: GHOSTED_CONTENT.wom.competitionExamples.slice(0, 2),
              },
            ]}
          />

          {competitions.length === 0 ? (
            <EmptyState
              message="No competitions found. Make sure WOM is configured and your group has competitions."
              action={<Link href="/app/community/" className="button button--secondary button--small">Back to Community</Link>}
            />
          ) : (
            <AppGrid>
              <Panel
                title="Competition board"
                eyebrow="All competitions"
                chip={`${competitions.length} total`}
                body={<CompetitionList entries={competitions} />}
              />
              <Panel
                title={featured?.title ?? 'Featured competition'}
                eyebrow="Competition detail"
                body={
                  featured ? (
                    <div className="app-stack">
                      <MetricGrid
                        items={[
                          ['Status', featured.status],
                          ['Metric', featured.metric ?? '-'],
                          ['Type', featured.type ?? '-'],
                          ['Starts', formatDate(featured.startsAt ?? null)],
                          ['Ends', formatDate(featured.endsAt ?? null)],
                          ['Participants', featured.participants ? String(featured.participants.length) : '-'],
                        ]}
                      />
                      {featured.participants && featured.participants.length > 0 ? (
                        <LeaderboardTable
                          entries={featured.participants.slice(0, 8) as LeaderboardEntry[]}
                          valueFormatter={(entry) => formatMaybeNumber(entry.progress?.gained ?? entry.gained ?? entry.value)}
                          valueLabel="Progress"
                        />
                      ) : null}
                    </div>
                  ) : (
                    <EmptyState message="Select a competition to see details." />
                  )
                }
              />
            </AppGrid>
          )}
        </>
      )}
    </main>
  );
}
