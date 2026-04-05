export type NavVisibility = 'always' | 'authenticated' | 'admin';

// Nav groups organise member sections into three zones:
//   clan     – roster, events, and clan records
//   economy  – the shared points economy (rewards, drops, casino)
//   you      – personal profile and linking
export type NavGroup = 'clan' | 'economy' | 'you';

export type NavLink = {
  key: string;
  label: string;
  href: string;
  visibility: NavVisibility;
  group?: NavGroup;
};

export type NavLinkGroup = {
  group: NavGroup | undefined;
  links: NavLink[];
};

export type ExternalLink = {
  label: string;
  href: string;
};

export type NavViewer = {
  authenticated: boolean;
  isAdmin: boolean;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  clan: 'Clan',
  economy: 'Economy',
  you: 'You',
};

export const PRIMARY_NAV_LINKS: NavLink[] = [
  { key: 'news', label: 'News', href: '/news/', visibility: 'always' },
  { key: 'hub', label: 'Hall', href: '/app/', visibility: 'authenticated' },
  { key: 'clan', label: 'Clan', href: '/app/clan/', visibility: 'authenticated', group: 'clan' },
  { key: 'competitions', label: 'Competitions', href: '/app/competitions/', visibility: 'authenticated', group: 'clan' },
  { key: 'rewards', label: 'Rewards', href: '/app/rewards/', visibility: 'authenticated', group: 'economy' },
  { key: 'casino', label: 'Casino', href: '/app/casino/', visibility: 'authenticated', group: 'economy' },
  { key: 'profile', label: 'Profile', href: '/app/profile/', visibility: 'authenticated', group: 'you' },
  { key: 'admin', label: 'Admin', href: '/admin/', visibility: 'admin' },
];

export const EXTERNAL_NAV_LINKS: ExternalLink[] = [
  { label: 'Twitch', href: 'https://www.twitch.tv/vghosted' },
  { label: 'Discord', href: 'https://discord.gg/ghosted' },
];

function normalizePath(path: string) {
  if (!path) return '/';
  if (path !== '/' && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function canView(link: NavLink, viewer: NavViewer) {
  if (link.visibility === 'always') return true;
  if (link.visibility === 'authenticated') return viewer.authenticated;
  return viewer.authenticated && viewer.isAdmin;
}

export function getVisiblePrimaryLinks(viewer: NavViewer) {
  return PRIMARY_NAV_LINKS.filter((link) => canView(link, viewer));
}

// Returns visible links bucketed into sequential groups, preserving order.
// Ungrouped links (home, hub, admin) get their own buckets with group=undefined.
export function getVisibleGroupedLinks(viewer: NavViewer): NavLinkGroup[] {
  const visible = getVisiblePrimaryLinks(viewer);
  const result: NavLinkGroup[] = [];

  for (const link of visible) {
    const last = result[result.length - 1];
    if (last && last.group === link.group) {
      last.links.push(link);
    } else {
      result.push({ group: link.group, links: [link] });
    }
  }

  return result;
}

export function getActiveNavKey(path: string) {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  if (normalized.startsWith('/news')) return 'news';
  if (normalized === '/app') return 'hub';
  if (normalized.startsWith('/app/community') || normalized.startsWith('/app/clan')) return 'clan';
  if (normalized.startsWith('/app/competitions')) return 'competitions';
  if (normalized.startsWith('/app/rewards') || normalized.startsWith('/app/giveaways')) return 'rewards';
  if (normalized.startsWith('/app/profile')) return 'profile';
  if (normalized.startsWith('/app/casino')) return 'casino';
  if (normalized.startsWith('/admin')) return 'admin';
  return '';
}
