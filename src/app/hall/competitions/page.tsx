'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Highlight,
  Panel,
  MetricGrid,
  LeaderboardTable,
  EmptyState,
  Banner,
  CompetitionList,
} from '@/components/ui/AppUI';
import { formatDate, formatMaybeNumber, formatMetricLabel, getJSON } from '@/lib/api';
import type { Competition, LeaderboardEntry, WomCompetitionDetailResponse, WomCompetitionsResponse } from '@/lib/types';
import styles from './page.module.css';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [featured, setFeatured] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const compsData = await getJSON<WomCompetitionsResponse>('/api/wom/competitions?limit=12')
          .then((data) => data.competitions ?? []);
        setCompetitions(compsData);

        if (compsData.length > 0) {
          const first = compsData[0];
          const detail = await getJSON<WomCompetitionDetailResponse | Competition>(`/api/wom/competitions/${first.id}`).catch(() => null);
          if (detail) {
            setFeatured('competition' in detail ? detail.competition : detail);
          }
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
  const featuredCompetition = featured ?? ongoing[0] ?? upcoming[0] ?? finished[0] ?? null;
  const liveWindow = [...ongoing, ...upcoming];
  const archiveWindow = finished.slice(0, 6);
  const featuredParticipants = featuredCompetition?.participants?.slice(0, 8) as LeaderboardEntry[] | undefined;
  const featuredTitle = featuredCompetition?.displayTitle ?? featuredCompetition?.title ?? 'Ghosted competitions';
  const featuredParticipantCount = featuredCompetition?.participantCount ?? featuredCompetition?.participants?.length ?? 0;

  return (
    <main id="main-content" className={`page-shell workspace-page ${styles.page}`}>
      {error ? <Banner message={error} variant="error" /> : null}

      {loading ? (
        <Banner message="Loading competitions..." variant="info" />
      ) : (
        <>
          <Highlight
            className="comp-highlight"
            eyebrow="Competition board"
            title={featuredTitle}
            copy={
              featuredCompetition
                ? `${featuredCompetition.status === 'ongoing' ? 'Live now' : featuredCompetition.status === 'upcoming' ? 'Up next' : 'Most recently finished'} for Ghosted. Open the board for the current leaders, timing, and tracked progress.`
                : 'Track the live and upcoming Wise Old Man boards for Ghosted and see who is currently ahead.'
            }
            actions={(
              <>
                <a href="#featured-board" className="button button--small">Open featured board</a>
                <a href="#competition-timeline" className="button button--secondary button--small">See timeline</a>
              </>
            )}
            stage={{
              label: 'Featured board',
              primary: featuredCompetition ? formatMetricLabel(featuredCompetition.metric) : `${ongoing.length} live`,
              secondary: featuredCompetition
                ? `${featuredCompetition.status} board with ${featuredParticipantCount} tracked participants`
                : `${upcoming.length} upcoming / ${finished.length} finished`,
              chips: [
                `${competitions.length} tracked events`,
                `${ongoing.length} live now`,
              ],
            }}
          />

          {competitions.length === 0 ? (
            <EmptyState
              message="No competitions found. Make sure Wise Old Man is configured and your group has competitions."
              action={<Link href="/hall/clan/" className="button button--secondary button--small">Back to clan</Link>}
            />
          ) : (
            <>
              <section id="featured-board" className={styles.board}>
                <Panel
                  className="comp-board"
                  tier="primary"
                  eyebrow="Start here"
                  title={featuredTitle}
                  chip={featuredCompetition?.status ?? undefined}
                  body={(
                    <div className={styles.boardLead}>
                      <p className={styles.boardNote}>
                        {featuredCompetition
                          ? 'The tracked skill, timing, and current leaders all update here.'
                          : 'Competition details will appear here once a featured board is available.'}
                      </p>
                      <MetricGrid
                        items={[
                          ['Status', featuredCompetition?.status ?? '-'],
                          ['Metric', featuredCompetition ? formatMetricLabel(featuredCompetition.metric) : '-'],
                          ['Type', featuredCompetition?.type ?? '-'],
                          ['Starts', formatDate(featuredCompetition?.startsAt ?? null)],
                          ['Ends', formatDate(featuredCompetition?.endsAt ?? null)],
                          ['Participants', featuredCompetition ? String(featuredParticipantCount) : '-'],
                        ]}
                      />
                      {featuredParticipants && featuredParticipants.length > 0 ? (
                        <div className={styles.boardTable}>
                          <LeaderboardTable
                            entries={featuredParticipants}
                            valueFormatter={(entry) => formatMaybeNumber(entry.displayValue ?? entry.progress?.gained ?? entry.gained ?? entry.value)}
                            valueLabel="Progress"
                          />
                        </div>
                      ) : (
                        <EmptyState message="Leaderboard data will appear after participants are recorded." />
                      )}
                    </div>
                  )}
                />
                <div className={styles.rail}>
                  <section id="competition-timeline">
                    <Panel
                      className="comp-timeline"
                      tier="meta"
                      eyebrow="Timeline"
                      title="Live and upcoming timeline"
                      chip={`${liveWindow.length} entries`}
                      body={<CompetitionList entries={liveWindow.length > 0 ? liveWindow : competitions} compact />}
                    />
                  </section>
                  <Panel
                    className="comp-archive"
                    tier="meta"
                    eyebrow="Archive"
                    title="Finished boards"
                    chip={`${finished.length} finished`}
                    body={
                      archiveWindow.length > 0 ? (
                        <CompetitionList entries={archiveWindow} compact />
                      ) : (
                        <EmptyState message="No finished competitions are recorded yet." />
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
