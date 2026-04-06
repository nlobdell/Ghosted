import type { WomRosterEntry } from '@/lib/types';

const CLAN_RANK_ALIASES: Record<string, string> = {
  jmod: 'jagex_moderator',
  clan_owner: 'owner',
  founder: 'owner',
  deputy: 'deputy_owner',
  co_owner: 'deputy_owner',
  coowner: 'deputy_owner',
  mod: 'moderator',
  admin: 'administrator',
};

// Lower numbers mean higher rank.
// This is the Ghosted ladder as specified by the user, not WOM/wiki ordering.
const GHOSTED_RANK_LADDER = [
  'jagex_moderator',
  'owner',
  'deputy_owner',
  'administrator',
  'moderator',
  'event_captain',
  'event_coordinator',
  'gnome_elder',
  'onyx',
  'diamond',
  'marshal',
  'admiral',
  'brigadier',
  'colonel',
  'commander',
  'officer',
  'general',
  'captain',
  'lieutenant',
  'sergeant',
  'novice',
  'corporal',
  'recruit',
  'thief',
  'guest',
] as const;

const GHOSTED_RANK_POSITION = new Map<string, number>(
  GHOSTED_RANK_LADDER.map((rank, index) => [rank, index]),
);

export function normalizeClanRankKey(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveClanRankKey(rankLabel?: string | null, roleKey?: string | null) {
  const token = normalizeClanRankKey(roleKey || rankLabel);
  if (!token) return null;
  return CLAN_RANK_ALIASES[token] ?? token;
}

export function getClanRankSortIndex(entry: Pick<WomRosterEntry, 'rankLabel' | 'roleKey' | 'rankOrder'>) {
  const token = resolveClanRankKey(entry.rankLabel, entry.roleKey);
  if (token && GHOSTED_RANK_POSITION.has(token)) {
    return GHOSTED_RANK_POSITION.get(token) ?? null;
  }

  if (entry.rankOrder != null) return 1000 + entry.rankOrder;
  return null;
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { sensitivity: 'base' });
}

export function compareClanRankEntries(
  left: Pick<WomRosterEntry, 'rankLabel' | 'roleKey' | 'rankOrder'>,
  right: Pick<WomRosterEntry, 'rankLabel' | 'roleKey' | 'rankOrder'>,
) {
  const leftPosition = getClanRankSortIndex(left);
  const rightPosition = getClanRankSortIndex(right);
  if (leftPosition != null && rightPosition != null && leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  if (leftPosition != null || rightPosition != null) {
    return leftPosition != null ? -1 : 1;
  }

  return compareText(left.rankLabel, right.rankLabel);
}
