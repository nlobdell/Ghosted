import { compareClanRankEntries } from '@/lib/clan-ranks';
import type { WomRosterEntry } from '@/lib/types';

export const ROSTER_SORT_OPTIONS = ['rank', 'xp', 'name', 'clan-rank', 'build', 'status'] as const;
export const ROSTER_DIRECTION_OPTIONS = ['asc', 'desc'] as const;

export type RosterSortKey = (typeof ROSTER_SORT_OPTIONS)[number];
export type SortDirection = (typeof ROSTER_DIRECTION_OPTIONS)[number];

export const ROSTER_SORT_LABELS: Record<RosterSortKey, string> = {
  rank: 'Roster order',
  xp: 'Overall XP',
  name: 'Name',
  'clan-rank': 'Clan rank',
  build: 'Build',
  status: 'Status',
};

export const ROSTER_DIRECTION_LABELS: Record<SortDirection, string> = {
  asc: 'Ascending',
  desc: 'Descending',
};

export function defaultDirectionForRosterSort(sortKey: RosterSortKey): SortDirection {
  return sortKey === 'name' || sortKey === 'build' || sortKey === 'status' ? 'asc' : 'desc';
}

export function normalizeRosterSort(value?: string): RosterSortKey {
  return ROSTER_SORT_OPTIONS.includes(value as RosterSortKey) ? (value as RosterSortKey) : 'clan-rank';
}

export function normalizeRosterDirection(value: string | undefined, sortKey: RosterSortKey): SortDirection {
  return ROSTER_DIRECTION_OPTIONS.includes(value as SortDirection)
    ? (value as SortDirection)
    : defaultDirectionForRosterSort(sortKey);
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

export function sortRosterEntries(entries: WomRosterEntry[], sortKey: RosterSortKey, direction: SortDirection) {
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

export function rosterHref(page: number, sortKey: RosterSortKey, direction: SortDirection) {
  const params = new URLSearchParams();
  const defaultDirection = defaultDirectionForRosterSort(sortKey);
  if (page > 1) params.set('page', String(page));
  if (sortKey !== 'clan-rank') params.set('sort', sortKey);
  if (direction !== defaultDirection) params.set('dir', direction);
  const query = params.toString();
  return query ? `/roster/?${query}` : '/roster/';
}
