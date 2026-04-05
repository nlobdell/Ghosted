export interface ShellUser {
  id: number;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  balance: number;
  isAdmin: boolean;
  perks: string[];
  roles: string[];
  roleDetails: { id: string; label: string; source: string }[];
  womLink: WomLink;
}

export interface WomLink {
  linked: boolean;
  username?: string;
  displayName?: string;
  membership?: {
    role?: string;
    rankLabel?: string;
    groupName?: string;
  };
}

export interface ShellData {
  authenticated: boolean;
  user?: ShellUser;
  brand: { label: string; href: string };
  navigation: { key: string; label: string; href: string }[];
  links: Record<string, { key: string; label: string; href: string; target?: string; rel?: string; presentation?: string }>;
  utilityGroups: Record<string, string[]>;
  activeRouteKey: string;
  auth: { canSignIn: boolean; loginHref?: string };
  wom: {
    configured: boolean;
    linked: boolean;
    inGroup: boolean;
    membership?: { rankLabel?: string; role?: string; groupName?: string };
  };
}

export interface AppConfig {
  womConfigured: boolean;
  authConfigured: boolean;
  devAuthEnabled: boolean;
}

export interface StatItem {
  label: string;
  value: string;
  href?: string;
}

export interface LedgerEntry {
  createdAt: string;
  entryType: string;
  description: string;
  amount: number;
}

export interface SpinRecord {
  createdAt: string;
  result: string;
  payout: number;
}

export interface RewardsData {
  balance: number;
  dailyRemaining: number;
  dailyCap: number | null;
  entries: LedgerEntry[];
  spins: SpinRecord[];
}

export interface GiveawayItem {
  id: number;
  title: string;
  description?: string;
  status: string;
  pointCost: number;
  userEntries: number;
  maxEntries: number;
  endAt: string;
  requiredRole?: { id: string; label: string };
  canEnter: boolean;
}

export interface WomPlayer {
  id: number;
  username: string;
  displayName?: string;
  type?: string;
  build?: string;
}

export interface LeaderboardEntry {
  player: WomPlayer;
  rank?: number;
  value?: number;
  gained?: number;
  raw?: Record<string, unknown>;
  progress?: { gained: number; start?: number; end?: number };
}

export interface ClanGroup {
  name: string;
  description?: string;
  clanChat?: string;
  homeworld?: string;
  score?: number;
  memberCount: number;
  verified: boolean;
  updatedAt?: string;
}

export interface ClanData {
  group: ClanGroup;
  linkCoverage: {
    trackedUsers: number;
    linkedUsers: number;
    unlinkedUsers: number;
    groupMemberCount: number;
  };
  statistics: {
    maxedTotalCount: number;
    maxedCombatCount: number;
    maxed200msCount: number;
    averageOverallLevel?: number;
    averageEhp?: number;
    averageEhb?: number;
  };
  recentAchievements: AchievementItem[];
  recentActivity: ActivityItem[];
}

export interface AchievementItem {
  title?: string;
  type?: string;
  metric?: string;
  createdAt?: string;
}

export interface ActivityItem {
  title?: string;
  type?: string;
  createdAt?: string;
}

export interface WomMeData {
  linked: boolean;
  username?: string;
  displayName?: string;
  membership?: { role?: string; rankLabel?: string; groupName?: string };
}

export interface Competition {
  id: number;
  title: string;
  metric: string;
  type: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  participants?: LeaderboardEntry[];
}

export interface NewsPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: 'draft' | 'published';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  authorDisplayName: string;
}
