import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import { formatMaybeNumber } from '@/lib/api';
import { getServerJSON } from '@/lib/server-api';
import type { LeaderboardEntry, WomEntriesResponse } from '@/lib/types';
import styles from '../../roster/page.module.css';

export const metadata: Metadata = {
  title: 'Roster',
};

const PAGE_SIZE = 12;
const FETCH_LIMIT = 48;

function clampPage(value: number, max: number) {
  return Math.min(Math.max(1, value), Math.max(1, max));
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const hiscorePayload = await getServerJSON<WomEntriesResponse | { hiscores?: LeaderboardEntry[] }>(
    `/api/wom/hiscores?metric=overall&limit=${FETCH_LIMIT}`,
  );
  const allMembers = hiscorePayload
    ? ('entries' in hiscorePayload ? hiscorePayload.entries : (hiscorePayload.hiscores ?? []))
    : [];

  const totalPages = Math.max(1, Math.ceil(allMembers.length / PAGE_SIZE));
  const requestedPage = Number(params.page ?? '1');
  const currentPage = clampPage(Number.isFinite(requestedPage) ? requestedPage : 1, totalPages);
  const pageMembers = allMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.page}`}>
      <section className={`editorial-surface editorial-stack ${styles.header}`}>
        <p className="kicker">Public roster</p>
        <h1>Ghosted member directory</h1>
        <p className="editorial-copy">
          A public snapshot of the Ghosted clan pulse, anchored by Wise Old Man data and arranged as a fast-scanning
          member grid before you ever enter the Hall.
        </p>
        <div className="app-inline-actions">
          <Link href="/hall/clan/" className="button">Open Hall clan view</Link>
          <a href={GHOSTED_CONTENT.links.discord} className="button button--secondary" target="_blank" rel="noopener noreferrer">
            Join Discord
          </a>
        </div>
      </section>

      <section className={styles.filters}>
        <span className="app-chip">Verified group {GHOSTED_CONTENT.wom.groupId}</span>
        <span className="app-chip">{GHOSTED_CONTENT.wom.memberCount} WOM members</span>
        <span className="app-chip">Showing {allMembers.length} ranked members</span>
      </section>

      <section className={`editorial-grid-three ${styles.grid}`}>
        {pageMembers.map((member, index) => (
          <article key={`${member.player.username}-${index}`} className={`editorial-surface editorial-card ${styles.card}`}>
            <div className={styles.cardHeader}>
              <span className="app-chip">#{member.rank ?? ((currentPage - 1) * PAGE_SIZE) + index + 1}</span>
              <span>{member.player.type ?? 'Member'}</span>
            </div>
            <h2>{member.player.displayName || member.player.username}</h2>
            <p>@{member.player.username}</p>
            <div className={styles.stats}>
              <div>
                <span>Overall</span>
                <strong>{formatMaybeNumber(member.value)}</strong>
              </div>
              <div>
                <span>Build</span>
                <strong>{member.player.build ?? 'Main'}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <nav className={styles.pagination} aria-label="Roster pages">
        <span className={styles.paginationMeta}>Page {currentPage} of {totalPages}</span>
        <div className="app-inline-actions">
          {currentPage > 1 ? (
            <Link href={`/roster/?page=${currentPage - 1}`} className="button button--secondary button--small">
              Previous page
            </Link>
          ) : null}
          {currentPage < totalPages ? (
            <Link href={`/roster/?page=${currentPage + 1}`} className="button button--secondary button--small">
              Next page
            </Link>
          ) : null}
        </div>
      </nav>
    </main>
  );
}
