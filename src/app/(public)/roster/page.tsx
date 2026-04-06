/* eslint-disable @next/next/no-img-element -- roster rank icons are small local static assets from the OSRS wiki sync. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';
import { formatMaybeNumber } from '@/lib/api';
import { clanRankIconPath } from '@/lib/clan-rank-icons';
import { compareClanRankEntries } from '@/lib/clan-ranks';
import { getServerJSON } from '@/lib/server-api';
import type { WomRosterData, WomRosterEntry } from '@/lib/types';
import { RosterSortForm } from '@/components/roster/RosterSortForm';
import styles from '../../roster/page.module.css';

export const metadata: Metadata = {
  title: 'Roster',
};

const PAGE_SIZE = 25;
const SORT_OPTIONS = ['rank', 'xp', 'name', 'clan-rank', 'build', 'status'] as const;
const DIRECTION_OPTIONS = ['asc', 'desc'] as const;
const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  rank: 'Roster order',
  xp: 'Overall XP',
  name: 'Name',
  'clan-rank': 'Clan rank',
  build: 'Build',
  status: 'Status',
};
const DIRECTION_LABELS: Record<(typeof DIRECTION_OPTIONS)[number], string> = {
  asc: 'Ascending',
  desc: 'Descending',
};

type RosterSortKey = (typeof SORT_OPTIONS)[number];
type SortDirection = (typeof DIRECTION_OPTIONS)[number];

function clampPage(value: number, max: number) {
  return Math.min(Math.max(1, value), Math.max(1, max));
}

function normalizeSort(value?: string): RosterSortKey {
  return SORT_OPTIONS.includes(value as RosterSortKey) ? (value as RosterSortKey) : 'rank';
}

function defaultDirectionForSort(sortKey: RosterSortKey): SortDirection {
  return sortKey === 'rank' ? 'desc' : 'asc';
}

function normalizeDirection(value: string | undefined, sortKey: RosterSortKey): SortDirection {
  return DIRECTION_OPTIONS.includes(value as SortDirection) ? (value as SortDirection) : defaultDirectionForSort(sortKey);
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { sensitivity: 'base' });
}

function compareName(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: SortDirection,
) {
  return direction === 'desc' ? compareText(left, right) : compareText(right, left);
}

function sortRoster(entries: WomRosterEntry[], sortKey: RosterSortKey, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...entries].sort((left, right) => {
    let value = 0;
    let applyMultiplier = true;

    switch (sortKey) {
      case 'xp':
        value = Number(left.value ?? 0) - Number(right.value ?? 0);
        break;
      case 'name':
        value = compareName(
          left.player.displayName ?? left.player.username,
          right.player.displayName ?? right.player.username,
          direction,
        );
        applyMultiplier = false;
        break;
      case 'clan-rank':
        value = -compareClanRankEntries(left, right);
        break;
      case 'build':
        value = compareText(right.player.build, left.player.build);
        break;
      case 'status':
        value = compareText(right.player.status, left.player.status);
        break;
      case 'rank':
      default:
        value = Number(right.rank ?? 0) - Number(left.rank ?? 0);
        break;
    }

    if (value === 0) {
      value = Number(left.rank ?? 0) - Number(right.rank ?? 0);
    }

    if (value === 0) {
      value = compareText(left.player.username, right.player.username);
    }

    return applyMultiplier ? value * multiplier : value;
  });
}

function rosterHref(page: number, sortKey: RosterSortKey, direction: SortDirection) {
  const params = new URLSearchParams();
  const defaultDirection = defaultDirectionForSort(sortKey);
  if (page > 1) params.set('page', String(page));
  if (sortKey !== 'rank') params.set('sort', sortKey);
  if (direction !== defaultDirection) params.set('dir', direction);
  const query = params.toString();
  return query ? `/roster/?${query}` : '/roster/';
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const rosterPayload = await getServerJSON<WomRosterData>('/api/wom/roster');
  const sortKey = normalizeSort(params.sort);
  const direction = normalizeDirection(params.dir, sortKey);
  const allMembers = sortRoster(rosterPayload?.entries ?? [], sortKey, direction);
  const memberCount = rosterPayload?.group.memberCount ?? allMembers.length;
  const sortLabel = SORT_LABELS[sortKey];
  const directionLabel = DIRECTION_LABELS[direction];
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
