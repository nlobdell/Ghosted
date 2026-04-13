import type { GhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import type { GhostlingWorldId, GhostlingWorldPreset, GhostlingWorldSpec } from '@/lib/ghostling-world';

export type PublicNameSource = 'discord' | 'osrs';
export type OsrsClaimSource = 'manual_wom' | 'runelite_plugin';

export interface ShellUser {
  id: number;
  discordId: string;
  username: string;
  displayName: string;
  publicNameSource: PublicNameSource;
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
  playerId?: number | null;
  username?: string;
  displayName?: string;
  publicNameSource?: PublicNameSource;
  claimSource?: OsrsClaimSource | null;
  verifiedAt?: string | null;
  inGroup?: boolean;
  lastSyncedAt?: string | null;
  status?: string;
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
    username?: string | null;
    displayName?: string | null;
    publicNameSource?: PublicNameSource;
    claimSource?: OsrsClaimSource | null;
    verifiedAt?: string | null;
    inGroup: boolean;
    lastSyncedAt?: string | null;
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

export interface HallRewardsSummary {
  balance: number;
  dailyRemaining: number;
  dailyCap: number | null;
  entries: LedgerEntry[];
}

export type CompanionSlotKey = 'hat' | 'face' | 'neck' | 'body';

export interface CompanionAnimationFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
  offsetX?: number;
  offsetY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface CompanionMotionWave {
  amplitude: number;
  durationMs: number;
  phase?: number;
}

export interface CompanionMotionChannel {
  offsetX?: CompanionMotionWave;
  offsetY?: CompanionMotionWave;
  rotateDeg?: CompanionMotionWave;
  scaleX?: CompanionMotionWave;
  scaleY?: CompanionMotionWave;
}

export interface CompanionMotionAccent {
  key: string;
  groups: string[];
  intervalMsMin: number;
  intervalMsMax: number;
  durationMs: number;
  overrides: Record<string, CompanionMotionChannel>;
}

export interface CompanionLayerAnimation {
  mode: 'static' | 'spritesheet';
  fps: number;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  loop: boolean;
  sheetWidth?: number;
  sheetHeight?: number;
  frames?: CompanionAnimationFrame[];
}

export interface CompanionRenderSlice {
  key: string;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  targetX: number;
  targetY: number;
  targetWidth: number;
  targetHeight: number;
  motionGroup?: string | null;
}

export interface CompanionRenderPoint {
  x: number;
  y: number;
}

export interface CompanionRenderRect extends CompanionRenderPoint {
  width: number;
  height: number;
}

export interface CompanionItemRenderPieceMetadata {
  docRect: CompanionRenderRect;
}

export interface CompanionItemRenderMetadata {
  kind: 'ghostling-cosmetic';
  schemaVersion: 1;
  slot: CompanionSlotKey;
  canvas: {
    width: number;
    height: number;
  };
  baseRect: CompanionRenderRect;
  mount: CompanionRenderPoint;
  pieces: {
    front?: CompanionItemRenderPieceMetadata;
    back?: CompanionItemRenderPieceMetadata;
  };
}

export interface CompanionRenderLayer {
  key: string;
  role: string;
  src: string;
  zIndex: number;
  animation: CompanionLayerAnimation;
  slot?: CompanionSlotKey | null;
  motionGroup?: string | null;
  slices?: CompanionRenderSlice[];
}

export interface CompanionRenderManifest {
  width: number;
  height: number;
  motion: {
    shadowOpacity: number;
    rootGroup: string;
    channels: Record<string, CompanionMotionChannel>;
    slotGroups: Partial<Record<CompanionSlotKey, string>>;
    accents?: CompanionMotionAccent[];
  };
  debug?: {
    slotAnchors: Partial<Record<CompanionSlotKey, CompanionRenderPoint>>;
    shadowRect: CompanionRenderRect;
    actorMetrics?: CompanionActorMetrics;
  };
  layers: CompanionRenderLayer[];
}

export interface CompanionActorMetrics {
  sourceWidth: number;
  sourceHeight: number;
  visibleBounds: CompanionRenderRect;
  footprintBounds: CompanionRenderRect;
  feetAnchor: CompanionRenderPoint;
}

export interface CompanionPreviewSummary {
  user: {
    displayName: string;
    username: string;
  } | null;
  renderUrl: string;
  animatedRenderUrl: string;
  renderManifest: CompanionRenderManifest;
  actorMetrics: CompanionActorMetrics;
}

export type DiscordPresenceChannelType = 'voice' | 'stage';
export type DiscordPresenceWorkerRuntimeStatus = 'idle' | 'running' | 'error';
export type DiscordPresenceBotInstallStatus = 'unknown' | 'installed' | 'not-installed';
export type DiscordPresenceWorkerHealth = 'not-configured' | 'idle' | 'healthy' | 'stale' | 'error' | 'not-installed';

export interface DiscordVoicePresenceRow {
  guildId: string;
  discordId: string;
  channelId: string;
  displayName: string;
  username: string;
  joinedAt: string;
  lastSeenAt: string;
}

export interface ScenePresenceChannelAllowlistEntry {
  guildId: string;
  channelId: string;
  channelName: string;
  channelType: DiscordPresenceChannelType;
  updatedAt: string;
}

export interface DiscordPresenceWorkerState {
  guildId: string;
  runtimeStatus: DiscordPresenceWorkerRuntimeStatus;
  botInstallStatus: DiscordPresenceBotInstallStatus;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface DiscordPresenceWorkerSummary {
  configured: boolean;
  guildId: string | null;
  health: DiscordPresenceWorkerHealth;
  state: DiscordPresenceWorkerState | null;
}

export interface DiscordPresenceAdminModuleStatus {
  key: string;
  label: string;
  enabled: boolean;
}

export interface DiscordPresenceAdminChannel {
  id: string;
  name: string;
  type: DiscordPresenceChannelType;
  selected: boolean;
}

export interface DiscordPresenceAdminData {
  actor: {
    displayName: string;
  };
  guild: {
    id: string | null;
    configured: boolean;
    ready: boolean;
  };
  publicMode: 'bot' | 'widget';
  worker: DiscordPresenceWorkerSummary & {
    activeModules: DiscordPresenceAdminModuleStatus[];
  };
  channels: DiscordPresenceAdminChannel[];
  allowlist: ScenePresenceChannelAllowlistEntry[];
  channelFetchError?: string | null;
}

export type AdminSectionKey = 'rewards' | 'content' | 'systems' | 'worlds' | 'ghostling';
export type AdminSectionStatus = 'ready' | 'warning' | 'critical';

export interface AdminAlert {
  id: string;
  title: string;
  detail: string;
  variant: 'info' | 'warning' | 'error';
  section?: AdminSectionKey;
  href?: string;
  ctaLabel?: string;
}

export interface AdminAuditEntry {
  id: number;
  action: string;
  actionLabel: string;
  section: AdminSectionKey;
  targetType: string;
  targetId: string;
  actorDisplayName: string;
  createdAt: string;
  summary: string;
}

export interface AdminSectionSummary {
  key: AdminSectionKey;
  label: string;
  href: string;
  status: AdminSectionStatus;
  primary: string;
  secondary: string;
  chips: string[];
}

export interface AdminRoleOption {
  id: string;
  name: string;
}

export interface AdminUserBalanceRow {
  id: number;
  discordId: string;
  displayName: string;
  balance: number;
  isAdmin: boolean;
}

export interface AdminGiveawayRow {
  id: number;
  title: string;
  status: string;
  pointCost: number;
  maxEntries: number;
  totalEntries: number;
  endAt: string;
  requiredRoleLabel?: string | null;
}

export interface AdminWomSummary {
  configured: boolean;
  linkedUsers: number;
}

export interface AdminOverviewData {
  actor: { displayName: string };
  overview: {
    users: AdminUserBalanceRow[];
    giveaways: Pick<AdminGiveawayRow, 'id' | 'title' | 'status'>[];
    wom: AdminWomSummary | null;
    newsCount?: number;
  };
  alerts: AdminAlert[];
  sectionSummaries: AdminSectionSummary[];
  quickActionReferenceData: {
    roles: AdminRoleOption[];
  };
  recentAudit: AdminAuditEntry[];
}

export interface AdminRewardsData {
  actor: { displayName: string };
  alerts: AdminAlert[];
  sectionSummary: AdminSectionSummary;
  stats: {
    trackedUsers: number;
    adminUsers: number;
    activeGiveaways: number;
    scheduledGiveaways: number;
    recentGrantCount: number;
  };
  roles: AdminRoleOption[];
  users: AdminUserBalanceRow[];
  giveaways: AdminGiveawayRow[];
  recentAudit: AdminAuditEntry[];
}

export interface AdminContentData {
  actor: { displayName: string };
  alerts: AdminAlert[];
  sectionSummary: AdminSectionSummary;
  stats: {
    draftCount: number;
    publishedCount: number;
    recentlyPublishedCount: number;
  };
  posts: NewsPost[];
  recentAudit: AdminAuditEntry[];
}

export interface AdminSystemsData {
  actor: { displayName: string };
  alerts: AdminAlert[];
  sectionSummary: AdminSectionSummary;
  wom: AdminWomSummary;
  discord: DiscordPresenceAdminData;
  recentAudit: AdminAuditEntry[];
}

export interface SceneWorldVariantRecord {
  worldId: GhostlingWorldId;
  draftPackageJson?: string | null;
  publishedPackageJson?: string | null;
  draftTuningJson?: string | null;
  publishedTuningJson?: string | null;
  draftUpdatedAt?: string | null;
  publishedAt?: string | null;
  draftUpdatedByUserId?: number | null;
  publishedByUserId?: number | null;
}

export interface AdminWorldArchivedLayer {
  worldId: GhostlingWorldId;
  layerKey: string;
  assetPath: string;
  assetUrl: string;
  archivedAt: string;
  archivedByDisplayName?: string | null;
}

export interface AdminWorldLayerAsset {
  key: string;
  zIndex: number;
  liveSrc: string;
  draftSrc: string;
  liveAssetPath: string;
  draftAssetPath: string;
  hasDraftOverride: boolean;
  hasArchivedOverride: boolean;
  isArchivedDraftOnly: boolean;
  archivedAssetPath?: string | null;
  archivedAssetUrl?: string | null;
  archivedAt?: string | null;
  archivedByDisplayName?: string | null;
}

export interface AdminWorldData {
  actor: { displayName: string };
  world: {
    id: GhostlingWorldId;
    preset: GhostlingWorldPreset;
    storageRoot: string;
    repoAssetRoot: string;
    hasDraft: boolean;
    hasPublishedVariant: boolean;
    archivedLayerCount: number;
    draftUpdatedAt?: string | null;
    publishedAt?: string | null;
  };
  publishedWorld: GhostlingWorldSpec;
  draftWorld: GhostlingWorldSpec;
  publishedTuning: GhostlingSceneTuningSpec;
  draftTuning: GhostlingSceneTuningSpec;
  layers: AdminWorldLayerAsset[];
  archivedLayers: AdminWorldArchivedLayer[];
  recentAudit: AdminAuditEntry[];
}

export type ScenePresenceMemberSource = 'voice' | 'wom' | 'fallback';
export type ScenePresenceVoiceSource = 'bot' | 'widget';
export type ScenePresencePayloadSource = 'voice' | 'wom' | 'empty';

export interface ScenePresenceActivity {
  firstSeenAt: string;
  lastSeenAt: string;
  freshness: 'new' | 'steady';
  strength: 'high' | 'medium';
}

export interface ScenePresenceMember {
  key: string;
  userId: number | null;
  username: string;
  displayName: string;
  source: ScenePresenceMemberSource;
  voiceSource?: ScenePresenceVoiceSource;
  activity: ScenePresenceActivity;
  companion?: CompanionPreviewSummary;
}

export type GhostlingMovementPhase = 'travel' | 'settle' | 'paused';

export interface SceneSharedEntityState {
  key: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  velocityX: number;
  velocityY: number;
  pauseRemainingMs: number;
  phaseRemainingMs: number;
  targetSerial: number;
  safeZoneKey: string;
  pointKey: string;
  scaleTier: 2 | 3;
  renderScale: number;
  movementPhase: GhostlingMovementPhase;
  facingLeft: boolean;
  opacity: number;
  jammedMs: number;
  fallback: boolean;
  source: ScenePresenceMemberSource;
  activeUntilTs: number;
  lastSeenSignature: string;
  actorMetrics: CompanionActorMetrics;
}

export interface SceneSharedSnapshot {
  version: number;
  variant: 'hero';
  width: number;
  height: number;
  savedAt: number;
  payloadSource: ScenePresencePayloadSource;
  liveCount: number;
  entities: SceneSharedEntityState[];
}

export interface ScenePresencePayload {
  members: ScenePresenceMember[];
  source: ScenePresencePayloadSource;
  sharedScene?: {
    hero?: SceneSharedSnapshot;
  };
}

export type ScenePresenceSocketMessage =
  | {
    type: 'scene:snapshot';
    payload: ScenePresencePayload;
    sentAt: string;
  }
  | {
    type: 'scene:error';
    code: 'unavailable';
    retryable: boolean;
  };

export interface CompanionItem {
  slug: string;
  name: string;
  slot: CompanionSlotKey;
  slotLabel: string;
  rarity: string;
  cost: number;
  description: string;
  active: boolean;
  archived: boolean;
  owned: boolean;
  equipped: boolean;
  previewUrl: string;
  frontAssetUrl?: string | null;
  backAssetUrl?: string | null;
  renderMetadata?: CompanionItemRenderMetadata | null;
}

export interface CompanionSlotState {
  key: CompanionSlotKey;
  label: string;
  equippedSlug: string | null;
  ownedOptions: Array<{
    slug: string;
    name: string;
    rarity: string;
    cost: number;
  }>;
}

export interface CompanionData {
  user: {
    id: number;
    displayName: string;
    username: string;
  };
  balance: number;
  ownedCount: number;
  equippedCount: number;
  loadout: Record<CompanionSlotKey, string | null>;
  slots: CompanionSlotState[];
  items: CompanionItem[];
  renderUrl: string;
  animatedRenderUrl: string;
  cardUrl: string;
  animatedCardUrl: string;
  renderManifest: CompanionRenderManifest;
  share: {
    avatarUrl: string;
    animatedAvatarUrl: string;
    cardUrl: string;
    animatedCardUrl: string;
    discordCardUrl: string;
    animatedDiscordCardUrl: string;
    animatedDiscordEmbedUrl: string;
  };
  baseAssetUrl?: string | null;
}

export interface HallCompanionSummary extends CompanionPreviewSummary {
  user: {
    displayName: string;
    username: string;
  };
  balance: number;
  ownedCount: number;
  equippedCount: number;
}

export interface CompanionAdminAssetItem {
  slug: string;
  name: string;
  slot: CompanionSlotKey;
  rarity: string;
  cost: number;
  description: string;
  active: boolean;
  archived: boolean;
  state: 'visible' | 'hidden' | 'archived';
  sortOrder: number;
  frontAssetPath?: string | null;
  frontAssetUrl?: string | null;
  backAssetPath?: string | null;
  backAssetUrl?: string | null;
  renderMetadata?: CompanionItemRenderMetadata | null;
  previewUrl: string;
  updatedAt?: string | null;
  archivedAt?: string | null;
  archivedByDisplayName?: string | null;
}

export interface CompanionRepoImportCandidate {
  slug: string;
  name: string;
  suggestedSlot?: CompanionSlotKey | null;
  suggestedRarity?: string | null;
  suggestedCost?: number | null;
  suggestedDescription?: string | null;
  frontAssetPath?: string | null;
  frontAssetUrl?: string | null;
  backAssetPath?: string | null;
  backAssetUrl?: string | null;
  renderMetadataPath?: string | null;
  renderMetadata?: CompanionItemRenderMetadata | null;
  renderMetadataErrors?: string[];
}

export interface CompanionAdminData {
  storageRoot: string;
  defaultAssetRoot: string;
  base: {
    assetPath: string;
    assetUrl?: string | null;
    bodyAssetPath: string;
    bodyAssetUrl?: string | null;
    headAssetPath?: string | null;
    headAssetUrl?: string | null;
    previewUrl: string;
    updatedAt?: string | null;
    renderManifest: CompanionRenderManifest;
  };
  items: CompanionAdminAssetItem[];
  archivedItems: CompanionAdminAssetItem[];
  repoCandidates: CompanionRepoImportCandidate[];
  recentAudit: AdminAuditEntry[];
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
  metric?: string;
  value?: number;
  displayValue?: number;
  gained?: number;
  valueKind?: 'level' | 'kills' | 'score' | 'computed' | 'gained';
  experience?: number;
  level?: number;
  score?: number;
  raw?: Record<string, unknown>;
  progress?: { gained: number; start?: number; end?: number };
  updatedAt?: string;
}

export interface WomRosterEntry {
  player: WomPlayer & {
    status?: string;
  };
  rank: number;
  value?: number;
  roleKey?: string | null;
  role: string;
  rankLabel: string;
  rankOrder?: number | null;
  joinedAt?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
}

export interface WomRosterData {
  group: ClanGroup & { id?: number };
  entries: WomRosterEntry[];
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
    averageOverallExperience?: number;
    averageEhp?: number;
    averageEhb?: number;
  };
  featuredHiscores?: {
    metric?: string;
    entries: LeaderboardEntry[];
  };
  featuredGains?: {
    metric?: string;
    period?: string;
    entries: LeaderboardEntry[];
  };
  skillOfTheWeek?: {
    competition: Competition;
    mode: 'active' | 'latest_finished';
    standings: LeaderboardEntry[];
  } | null;
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
  player: {
    id?: number;
    username?: string;
    displayName?: string;
    type?: string;
    build?: string;
    status?: string;
    exp?: number;
    ehp?: number;
    ehb?: number;
    updatedAt?: string;
    lastChangedAt?: string;
    lastImportedAt?: string;
  };
  membership?: { role?: string; rankLabel?: string; groupName?: string };
  gains?: Record<string, unknown>;
  achievements?: AchievementItem[];
  competitions?: Competition[];
}

export interface Competition {
  id: number;
  title: string;
  displayTitle?: string;
  metric: string;
  type: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  groupId?: number;
  score?: number;
  participantCount?: number;
  series?: 'skill_of_the_week' | 'competition';
  participants?: LeaderboardEntry[];
  raw?: Record<string, unknown>;
}

export interface WomEntriesResponse {
  metric?: string;
  period?: string;
  entries: LeaderboardEntry[];
}

export interface WomCompetitionsResponse {
  competitions: Competition[];
}

export interface WomCompetitionDetailResponse {
  competition: Competition;
  topHistory?: Array<Record<string, unknown>>;
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

export interface HallGiveawaySummary {
  activeCount: number;
}

export interface HallClanSummary {
  name?: string | null;
  memberCount?: number | null;
}

export interface HallDashboardData {
  authenticated: boolean;
  error?: string | null;
  rewards: HallRewardsSummary | null;
  companion: HallCompanionSummary | null;
  giveaways: HallGiveawaySummary;
  clan: HallClanSummary | null;
  competitions: Competition[];
  hiscores: LeaderboardEntry[];
}
