'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext, StatStrip, Panel, AppGrid, Highlight,
  CompetitionList, MetricGrid, LeaderboardTable, EmptyState, Banner,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
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
            title="Track active races and upcoming events."
            copy="Competition status, windows, and participant progress stay in one consistent view."
            chips={[
              `${ongoing.length} ongoing`,
              `${upcoming.length} upcoming`,
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
