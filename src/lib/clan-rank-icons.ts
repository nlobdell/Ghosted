import { normalizeClanRankKey, resolveClanRankKey } from '@/lib/clan-ranks';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ROLE_ICON_ALIASES: Record<string, string> = {
  member: 'recruit',
  event_captain: 'captain',
  event_coordinator: 'coordinator',
  deputy_owner: 'deputy-owner',
};

export function clanRankIconPath(rankLabel?: string | null, roleKey?: string | null) {
  const resolvedRole = resolveClanRankKey(rankLabel, roleKey);
  const roleSlug = resolvedRole ? (ROLE_ICON_ALIASES[resolvedRole] ?? resolvedRole) : '';
  const normalizedRole = slugify((roleKey ?? '').replaceAll('_', ' '));
  const normalizedRoleSlug = ROLE_ICON_ALIASES[normalizeClanRankKey(normalizedRole)] ?? normalizedRole;
  const labelSlug = slugify(rankLabel ?? '');
  const resolved = roleSlug || normalizedRoleSlug || labelSlug;
  if (!resolved) return null;
  return `/symbols/clan-ranks/${resolved}.png`;
}
