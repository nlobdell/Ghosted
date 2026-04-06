/* eslint-disable @next/next/no-img-element -- roster rank icons are small local static assets from the OSRS wiki sync. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import { formatMaybeNumber } from '@/lib/api';
import { clanRankIconPath } from '@/lib/clan-rank-icons';
import {
  normalizeRosterDirection,
  normalizeRosterSort,
  ROSTER_DIRECTION_LABELS,
  ROSTER_SORT_LABELS,
  rosterHref,
  sortRosterEntries,
} from '@/lib/roster-sort';
import { getServerJSON } from '@/lib/server-api';
import type { WomRosterData } from '@/lib/types';
import { RosterSortForm } from '@/components/roster/RosterSortForm';
import styles from '../../roster/page.module.css';

export const metadata: Metadata = {
  title: 'Roster',
};

const PAGE_SIZE = 25;

function clampPage(value: number, max: number) {
  return Math.min(Math.max(1, value), Math.max(1, max));
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const rosterPayload = await getServerJSON<WomRosterData>('/api/wom/roster');
  const sortKey = normalizeRosterSort(params.sort);
  const direction = normalizeRosterDirection(params.dir, sortKey);
  const allMembers = sortRosterEntries(rosterPayload?.entries ?? [], sortKey, direction);
  const memberCount = rosterPayload?.group.memberCount ?? allMembers.length;
  const sortLabel = ROSTER_SORT_LABELS[sortKey];
  const directionLabel = ROSTER_DIRECTION_LABELS[direction];
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
        <div className={styles.filtersSummary}>
          <div className={styles.filterChipRow}>
            <span className="app-chip">Verified group {GHOSTED_CONTENT.wom.groupId}</span>
            <span className="app-chip">{memberCount} clan members</span>
            <span className="app-chip">Showing {allMembers.length} public roster entries</span>
          </div>
          <span className={`app-chip ${styles.activeSortChip}`}>
            Sorted by {sortLabel} in {directionLabel.toLowerCase()} order
          </span>
        </div>
        <RosterSortForm sortKey={sortKey} direction={direction} />
      </section>

      <section className={styles.grid}>
        {pageMembers.map((member, index) => {
          const iconPath = clanRankIconPath(member.rankLabel, member.roleKey);
          return (
            <article key={`${member.player.username}-${index}`} className={`editorial-surface editorial-card ${styles.card}`}>
              <div className={styles.cardHeader}>
                <span className="app-chip">#{member.rank ?? ((currentPage - 1) * PAGE_SIZE) + index + 1}</span>
                <span className={`app-chip ${styles.rankChip}`}>
                  {iconPath ? (
                    <img
                      src={iconPath}
                      alt=""
                      aria-hidden="true"
                      className={styles.rankIcon}
                    />
                  ) : null}
                  {member.rankLabel}
                </span>
              </div>
              <h2>{member.player.displayName || member.player.username}</h2>
              <div className={styles.metaRow}>
                <span>{member.player.build ?? 'Main'}</span>
                <span>{member.player.status ?? 'active'}</span>
              </div>
              <div className={styles.stats}>
                <div>
                  <span>Clan rank</span>
                  <strong>{member.rankLabel}</strong>
                </div>
                <div>
                  <span>Overall XP</span>
                  <strong>{formatMaybeNumber(member.value)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <nav className={styles.pagination} aria-label="Roster pages">
        <span className={styles.paginationMeta}>Page {currentPage} of {totalPages} | {sortLabel} | {directionLabel}</span>
        <div className="app-inline-actions">
          {currentPage > 1 ? (
            <Link href={rosterHref(currentPage - 1, sortKey, direction)} className="button button--secondary button--small">
              Previous page
            </Link>
          ) : null}
          {currentPage < totalPages ? (
            <Link href={rosterHref(currentPage + 1, sortKey, direction)} className="button button--secondary button--small">
              Next page
            </Link>
          ) : null}
        </div>
      </nav>
    </main>
  );
}
