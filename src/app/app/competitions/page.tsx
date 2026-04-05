'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppContext,
  StatStrip,
  Panel,
  AppGrid,
  MetricGrid,
  LeaderboardTable,
  EmptyState,
  Banner,
  CompetitionList,
} from '@/components/app/AppUI';
import { formatMaybeNumber, formatDate, getJSON } from '@/lib/api';
import type { Competition, LeaderboardEntry } from '@/lib/types';
import styles from './page.module.css';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [featured, setFeatured] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const compsData = await getJSON<{ competitions?: Competition[] }>('/api/wom/competitions?limit=12')
          .then((data) => data.competitions ?? []);
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

    void load();
  }, []);

  const ongoing = competitions.filter((item) => item.status === 'ongoing');
  const upcoming = competitions.filter((item) => item.status === 'upcoming');
  const finished = competitions.filter((item) => item.status === 'finished');
  const featuredParticipants = featured?.participants?.slice(0, 8) as LeaderboardEntry[] | undefined;

  return (
    <main id="main-content" className={`page-shell ${styles.page}`}>
      <AppContext
        breadcrumbs={[
          { label: 'Ghosted', href: '/' },
          { label: 'Hall', href: '/app/' },
          { label: 'Competitions' },
        ]}
        title="Competition board"
        summary="Start with the active timeline, then drill into featured details and leaderboard context."
        actions={<Link href="/app/clan/" className="button button--secondary button--small">Clan</Link>}
      />

      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading competitions..." variant="info" />
      ) : (
        <>
          <StatStrip
            className="comp-scoreboard"
            leadIndex={1}
            stats={[
              { label: 'Tracked comps', value: String(competitions.length) },
              { label: 'Ongoing', value: String(ongoing.length) },
              { label: 'Upcoming', value: String(upcoming.length) },
              { label: 'Finished', value: String(finished.length) },
            ]}
          />

          {competitions.length === 0 ? (
            <EmptyState
              message="No competitions found. Make sure WOM is configured and your group has competitions."
              action={<Link href="/app/clan/" className="button button--secondary button--small">Back to clan</Link>}
            />
          ) : (
            <>
              <section className={styles.board}>
                <Panel
                  className="comp-timeline"
                  tier="primary"
                  eyebrow="Timeline"
                  title="Live and upcoming events"
                  chip={`${ongoing.length} live`}
                  body={<CompetitionList entries={competitions} />}
                />
                <div className={styles.rail}>
                  <Panel
                    className="comp-featured"
                    tier="primary"
                    eyebrow="Featured"
                    title={featured?.title ?? 'Featured competition'}
                    body={
                      featured ? (
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
                      ) : (
                        <EmptyState message="No featured competition selected." />
                      )
                    }
                  />
                  <Panel
                    className="comp-leaders"
                    tier="meta"
                    eyebrow="Leaders"
                    title="Featured leaderboard"
                    body={
                      featuredParticipants && featuredParticipants.length > 0 ? (
                        <LeaderboardTable
                          entries={featuredParticipants}
                          valueFormatter={(entry) => formatMaybeNumber(entry.progress?.gained ?? entry.gained ?? entry.value)}
                          valueLabel="Progress"
                        />
                      ) : (
                        <EmptyState message="Leaderboard data will appear after participants are recorded." />
                      )
                    }
                  />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
