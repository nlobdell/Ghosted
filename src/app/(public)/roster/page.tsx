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
  const leadMember = allMembers[0] ?? null;

  return (
    <main id="main-content" className={`page-shell editorial-page ${styles.page}`}>
      <section className={`editorial-surface editorial-stack ${styles.header}`}>
        <div className={styles.headerGrid}>
          <div className={styles.headerCopy}>
            <p className="kicker">Public roster</p>
            <h1>Ghosted Roster.</h1>
            <p className="editorial-copy">
              This roster shows Wise Old Man-verified membership, visible rank order, and who is carrying Ghosted right now.
            </p>
            <div className="app-inline-actions">
              <Link href="/hall/clan/" className="button">Open clan health in the Hall</Link>
              <a href={GHOSTED_CONTENT.links.discord} className="button button--secondary" target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.filters}>
        <div className={styles.filtersSummary}>
          <p className="kicker">Roster view</p>
          <h2>Sort the roster without losing the clan pulse.</h2>
          <div className={styles.filterChipRow}>
            <span className="app-chip">{memberCount} clan members</span>
            <span className="app-chip">Showing {allMembers.length} public roster entries</span>
          </div>
          <span className={`app-chip ${styles.activeSortChip}`}>
            Sorted by {sortLabel} in {directionLabel.toLowerCase()} order | page {currentPage} of {totalPages}
          </span>
        </div>
        <div className={styles.filterTools}>
          <aside className={styles.pulsePanel} aria-label="Roster summary">
            <span className="app-chip">Wise Old Man group {GHOSTED_CONTENT.wom.groupId}</span>
            <div className={styles.pulseList}>
              <div className={styles.pulseRow}>
                <span>Lead visible</span>
                <strong>{leadMember?.player.displayName || leadMember?.player.username || 'Ghosted member'}</strong>
              </div>
              <div className={styles.pulseRow}>
                <span>Tracked members</span>
                <strong>{memberCount}</strong>
              </div>
              <div className={styles.pulseRow}>
                <span>Home world</span>
                <strong>{GHOSTED_CONTENT.wom.homeworld}</strong>
              </div>
            </div>
          </aside>
          <RosterSortForm sortKey={sortKey} direction={direction} />
        </div>
      </section>

      <section className={styles.ledger} aria-label="Public roster ledger">
        <div className={styles.ledgerHead} aria-hidden="true">
          <span>Rank</span>
          <span>Member</span>
          <span>Roster ledger</span>
        </div>
        {pageMembers.map((member, index) => {
          const iconPath = clanRankIconPath(member.rankLabel, member.roleKey);
          const displayRank = member.rank ?? ((currentPage - 1) * PAGE_SIZE) + index + 1;
          const displayName = member.player.displayName || member.player.username;
          return (
            <article key={`${member.player.username}-${index}`} className={styles.ledgerRow}>
              <div className={styles.ledgerIndex}>
                <span>#{displayRank}</span>
              </div>
              <div className={styles.memberCell}>
                <h2>{displayName}</h2>
                <div className={styles.metaRow}>
                  {member.player.username && member.player.username !== displayName ? (
                    <span>@{member.player.username}</span>
                  ) : null}
                  <span>{member.player.status ?? 'active'}</span>
                </div>
              </div>
              <div className={styles.ledgerStats}>
                <div className={styles.ledgerStat}>
                  <span>Build</span>
                  <strong>{member.player.build ?? 'Main'}</strong>
                </div>
                <div className={styles.ledgerStat}>
                  <span>Clan rank</span>
                  <strong className={styles.rankValue}>
                    {iconPath ? (
                      <img
                        src={iconPath}
                        alt=""
                        aria-hidden="true"
                        className={styles.rankIcon}
                      />
                    ) : null}
                    {member.rankLabel}
                  </strong>
                </div>
                <div className={styles.ledgerStat}>
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
