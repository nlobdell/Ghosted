export type NavLink = {
  key: string;
  label: string;
  href: string;
};

export type ExternalLink = {
  label: string;
  href: string;
};

export const PUBLIC_NAV_LINKS: NavLink[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'community', label: 'Community', href: '/app/community/' },
  { key: 'rewards', label: 'Rewards', href: '/app/rewards/' },
  { key: 'giveaways', label: 'Giveaways', href: '/app/giveaways/' },
  { key: 'casino', label: 'Casino', href: '/app/casino/' },
  { key: 'app', label: 'App Hub', href: '/app/' },
];

export const APP_NAV_LINKS: NavLink[] = [
  { key: 'community', label: 'Community', href: '/app/community/' },
  { key: 'competitions', label: 'Competitions', href: '/app/competitions/' },
  { key: 'rewards', label: 'Rewards', href: '/app/rewards/' },
  { key: 'giveaways', label: 'Giveaways', href: '/app/giveaways/' },
  { key: 'profile', label: 'Profile', href: '/app/profile/' },
  { key: 'casino', label: 'Casino', href: '/app/casino/' },
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

export function getPublicActiveKey(path: string) {
  const normalized = normalizePath(path);
  if (normalized === '/') return 'home';
  if (normalized.startsWith('/app/community') || normalized.startsWith('/app/clan')) return 'community';
  if (normalized.startsWith('/app/rewards')) return 'rewards';
  if (normalized.startsWith('/app/giveaways')) return 'giveaways';
  if (normalized.startsWith('/app/casino')) return 'casino';
  if (normalized.startsWith('/app')) return 'app';
  return '';
}

export function getAppActiveKey(path: string) {
  const normalized = normalizePath(path);
  if (normalized.startsWith('/app/community') || normalized.startsWith('/app/clan')) return 'community';
  if (normalized.startsWith('/app/competitions')) return 'competitions';
  if (normalized.startsWith('/app/rewards')) return 'rewards';
  if (normalized.startsWith('/app/giveaways')) return 'giveaways';
  if (normalized.startsWith('/app/profile')) return 'profile';
  if (normalized.startsWith('/app/casino')) return 'casino';
  return '';
}
