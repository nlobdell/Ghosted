export type ApiConfig = {
  authConfigured: boolean;
  devAuthEnabled: boolean;
};

export type AuthUser = {
  avatarUrl?: string | null;
  balance: number;
  displayName: string;
  giveawayEntries?: number;
  isAdmin: boolean;
  perks?: string[];
  roles?: string[];
  username: string;
};

export type MePayload =
  | { authenticated: false }
  | { authenticated: true; user: AuthUser };

export type PaytableEntry = {
  kind: 'line' | 'scatter';
  label: string;
  payout: number;
  multiplier: number;
  symbols: string[];
  freeSpins?: number;
};

export type LineWin = {
  count: number;
  lineIndex: number;
  payout: number;
  positions: Array<[number, number]>;
  symbol: string;
};

export type Scatter = {
  count: number;
  freeSpinsAwarded: number;
  payout: number;
  positions: Array<[number, number]>;
  symbol: string;
};

export type SpinOutcome = {
  detail: string;
  headline: string;
  label: string;
};

export type SpinResult = {
  balance: number;
  baseWager: number;
  freeSpinsAwarded: number;
  freeSpinsRemaining: number;
  game: string;
  gameSlug: string;
  grid: string[][];
  lineWins: LineWin[];
  net: number;
  outcome: SpinOutcome;
  payout: number;
  scatter: Scatter;
  symbols: string[];
  usedFreeSpin: boolean;
  wager: number;
};

export type RewardsPayload = {
  balance: number;
  dailyCap: number | null;
  dailyRemaining: number | null;
  dailyWagered: number;
  spins: SpinResult[];
};

export type SlotGame = {
  accent: string;
  cost: number;
  flavor: string;
  freeSpinsRemaining: number;
  hitRate: number;
  id: number;
  jackpotLabel: string;
  mood: string;
  name: string;
  paylinesCount: number;
  paytable: PaytableEntry[];
  reelCount: number;
  reelSymbols: string[];
  returnRate: number;
  rows: number;
  scatterSymbol: string;
  slug: string;
  topPayout: number;
  volatility: string;
  wildSymbol: string;
};

export type GamesPayload = {
  dailyWagerCap: number | null;
  games: SlotGame[];
};

export type SpinApiPayload = {
  ok: true;
  result: SpinResult;
};

export type CasinoState = {
  config: ApiConfig | null;
  games: GamesPayload | null;
  latestResult: SpinResult | null;
  me: MePayload | null;
  rewards: RewardsPayload | null;
  selectedGameSlug: string | null;
  spinning: boolean;
};
