import 'server-only';

import type { Database } from 'better-sqlite3';
import { AppError, envText, humanizeIdentifier, jsonLoad, utcIso, utcNow } from '@/lib/server/core';
import { appendRewardLedger, getBalance } from '@/lib/server/rewards';

type SlotConfig = Record<string, unknown>;

type CasinoGameRow = {
  id: number;
  slug: string;
  name: string;
  cost: number;
  config_json: string;
  active: number;
};

type RecentSpinRow = {
  id: number;
  slug: string;
  name: string;
  cost: number;
  wager: number;
  payout: number;
  symbols_json: string;
  created_at: string;
};

type BonusStateRow = {
  game_id: number;
  free_spins_remaining: number;
};

type RandomSource = {
  nextInt: (maxExclusive: number) => number;
};

type PaytableEntry = {
  kind: 'line' | 'scatter';
  symbol: string;
  count: number;
  symbols: string[];
  multiplier: number;
  payout: number;
  freeSpins?: number;
  label: string;
};

type LineWin = {
  lineIndex: number;
  symbol: string;
  count: number;
  positions: Array<[number, number]>;
  symbols: string[];
  multiplier: number;
  payout: number;
};

type ScatterWin = {
  count: number;
  positions: Array<[number, number]>;
  payout: number;
  freeSpinsAwarded: number;
  symbol: string;
};

type EvaluatedSpin = {
  symbols: string[];
  grid: string[][];
  stops: number[];
  lineWins: LineWin[];
  scatter: ScatterWin;
  payout: number;
};

type SpinStoragePayload = {
  symbols?: unknown;
  grid?: unknown;
  stops?: unknown;
  lineWins?: unknown;
  scatter?: unknown;
  freeSpinsAwarded?: unknown;
  freeSpinsRemaining?: unknown;
  usedFreeSpin?: unknown;
};

export const SPIN_COOLDOWN_SECONDS = 2;

export const DEFAULT_CASINO_GAMES = [
  {
    slug: 'jigsaw-jackpot',
    name: 'Jigsaw Jackpot',
    cost: 20,
    config: {
      rows: 3,
      paylines: [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2],
        [0, 1, 2, 1, 0],
        [2, 1, 0, 1, 2],
        [0, 0, 1, 0, 0],
        [2, 2, 1, 2, 2],
        [1, 0, 0, 0, 1],
        [1, 2, 2, 2, 1],
        [0, 1, 1, 1, 0],
      ],
      reel_strips: [
        ['coin', 'moon', 'ghost', 'rune', 'coin', 'gem', 'scatter', 'moon', 'coin', 'mask', 'wild', 'ghost', 'gem', 'coin', 'moon', 'rune'],
        ['ghost', 'coin', 'gem', 'rune', 'moon', 'mask', 'coin', 'scatter', 'ghost', 'moon', 'wild', 'rune', 'coin', 'gem', 'moon', 'coin'],
        ['moon', 'coin', 'ghost', 'gem', 'rune', 'coin', 'wild', 'moon', 'mask', 'coin', 'scatter', 'ghost', 'moon', 'rune', 'gem', 'coin'],
        ['coin', 'mask', 'moon', 'rune', 'ghost', 'coin', 'gem', 'wild', 'moon', 'scatter', 'coin', 'ghost', 'rune', 'moon', 'coin', 'gem'],
        ['gem', 'coin', 'moon', 'ghost', 'rune', 'mask', 'coin', 'moon', 'wild', 'ghost', 'coin', 'scatter', 'moon', 'gem', 'coin', 'rune'],
      ],
      symbol_payouts: {
        wild: { 3: 2.5, 4: 10, 5: 40 },
        mask: { 3: 1.5, 4: 4, 5: 12 },
        gem: { 3: 1.2, 4: 3, 5: 10 },
        ghost: { 3: 0.8, 4: 2, 5: 6 },
        moon: { 3: 0.6, 4: 1.5, 5: 4 },
        rune: { 3: 0.5, 4: 1.2, 5: 3.5 },
        coin: { 3: 0.4, 4: 1, 5: 2.5 },
      },
      wild_symbol: 'wild',
      scatter_symbol: 'scatter',
      scatter_payouts: { 3: 1, 4: 4, 5: 15 },
      free_spins: { 3: 5, 4: 8, 5: 12 },
      top_payout: 1200,
      flavor: 'A 5x3 video slot with ten lines, sticky tension, and a classic free-spin trigger.',
      volatility: 'Medium',
      mood: 'Puzzle-box pressure',
      jackpot_label: '5 Wilds x40',
      accent: '#7bdff6',
      hit_rate: 0.31,
      return_rate: 0.93,
    },
  },
  {
    slug: 'ghost-lanterns',
    name: 'Ghost Lanterns',
    cost: 35,
    config: {
      rows: 3,
      paylines: [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2],
        [0, 1, 2, 1, 0],
        [2, 1, 0, 1, 2],
        [1, 0, 1, 2, 1],
        [1, 2, 1, 0, 1],
        [0, 1, 0, 1, 2],
        [2, 1, 2, 1, 0],
        [0, 0, 1, 2, 2],
      ],
      reel_strips: [
        ['coin', 'moon', 'lantern', 'ghost', 'rune', 'coin', 'wild', 'lantern', 'coin', 'moon', 'scatter', 'ghost', 'rune', 'coin', 'lantern', 'moon'],
        ['ghost', 'coin', 'lantern', 'rune', 'moon', 'coin', 'ghost', 'scatter', 'wild', 'moon', 'rune', 'coin', 'lantern', 'moon', 'ghost', 'coin'],
        ['moon', 'coin', 'ghost', 'lantern', 'rune', 'coin', 'moon', 'wild', 'lantern', 'coin', 'scatter', 'ghost', 'moon', 'rune', 'lantern', 'coin'],
        ['coin', 'lantern', 'moon', 'ghost', 'rune', 'coin', 'wild', 'lantern', 'moon', 'scatter', 'coin', 'ghost', 'rune', 'moon', 'coin', 'lantern'],
        ['lantern', 'coin', 'moon', 'ghost', 'rune', 'coin', 'moon', 'wild', 'ghost', 'coin', 'scatter', 'lantern', 'moon', 'rune', 'coin', 'ghost'],
      ],
      symbol_payouts: {
        wild: { 3: 3, 4: 12, 5: 50 },
        lantern: { 3: 1.8, 4: 5, 5: 16 },
        ghost: { 3: 1.2, 4: 3.5, 5: 10 },
        moon: { 3: 0.8, 4: 2, 5: 5 },
        rune: { 3: 0.6, 4: 1.5, 5: 4 },
        coin: { 3: 0.5, 4: 1.2, 5: 3 },
      },
      wild_symbol: 'wild',
      scatter_symbol: 'scatter',
      scatter_payouts: { 3: 1.5, 4: 5, 5: 18 },
      free_spins: { 3: 6, 4: 10, 5: 14 },
      top_payout: 2200,
      flavor: 'Higher-volatility lantern slot with deeper free-spin awards and louder line wins.',
      volatility: 'High',
      mood: 'Haunted high-volatility cabinet',
      jackpot_label: '5 Wilds x50',
      accent: '#ffd166',
      hit_rate: 0.27,
      return_rate: 0.95,
    },
  },
  {
    slug: 'royal-heist',
    name: 'Royal Heist',
    cost: 60,
    config: {
      rows: 3,
      paylines: [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2],
        [0, 1, 2, 1, 0],
        [2, 1, 0, 1, 2],
        [0, 1, 0, 1, 0],
        [2, 1, 2, 1, 2],
        [1, 0, 1, 0, 1],
        [1, 2, 1, 2, 1],
        [0, 1, 1, 1, 2],
      ],
      reel_strips: [
        ['coin', 'crown', 'gem', 'moon', 'coin', 'wild', 'ghost', 'gem', 'scatter', 'coin', 'crown', 'moon', 'rune', 'coin', 'ghost', 'gem'],
        ['gem', 'coin', 'crown', 'ghost', 'moon', 'coin', 'wild', 'gem', 'rune', 'scatter', 'coin', 'moon', 'crown', 'ghost', 'coin', 'gem'],
        ['coin', 'gem', 'crown', 'ghost', 'wild', 'moon', 'coin', 'scatter', 'gem', 'crown', 'rune', 'coin', 'ghost', 'moon', 'gem', 'coin'],
        ['ghost', 'coin', 'gem', 'crown', 'moon', 'wild', 'coin', 'gem', 'scatter', 'rune', 'coin', 'crown', 'ghost', 'moon', 'coin', 'gem'],
        ['coin', 'gem', 'ghost', 'moon', 'crown', 'coin', 'wild', 'scatter', 'gem', 'ghost', 'coin', 'moon', 'crown', 'rune', 'coin', 'gem'],
      ],
      symbol_payouts: {
        wild: { 3: 4, 4: 15, 5: 75 },
        crown: { 3: 2.5, 4: 7, 5: 22 },
        gem: { 3: 1.5, 4: 4.5, 5: 12 },
        ghost: { 3: 1, 4: 2.8, 5: 8 },
        moon: { 3: 0.8, 4: 2, 5: 5 },
        rune: { 3: 0.7, 4: 1.6, 5: 4 },
        coin: { 3: 0.5, 4: 1.3, 5: 3 },
      },
      wild_symbol: 'wild',
      scatter_symbol: 'scatter',
      scatter_payouts: { 3: 2, 4: 6, 5: 20 },
      free_spins: { 3: 7, 4: 10, 5: 15 },
      top_payout: 4500,
      flavor: 'Big-bet five-reel slot with premium crowns, fat wild lines, and long free-spin chains.',
      volatility: 'High',
      mood: 'High-limit centerpiece',
      jackpot_label: '5 Wilds x75',
      accent: '#ff5d8f',
      hit_rate: 0.24,
      return_rate: 0.96,
    },
  },
];

function defaultRandomSource(): RandomSource {
  return {
    nextInt(maxExclusive) {
      return Math.floor(Math.random() * maxExclusive);
    },
  };
}

function parseGameConfig(configJson: string): SlotConfig {
  return jsonLoad<SlotConfig>(configJson, {});
}

function slotRows(config: SlotConfig) {
  return Math.max(1, Number(config.rows ?? 3));
}

function slotPaylines(config: SlotConfig) {
  const paylines = Array.isArray(config.paylines) ? config.paylines : [];
  return paylines
    .map((line) => (Array.isArray(line) ? line.map((value) => Number(value)) : []))
    .filter((line) => line.length > 0);
}

function slotReelStrips(config: SlotConfig) {
  const strips = Array.isArray(config.reel_strips) ? config.reel_strips : [];
  return strips.map((strip) => (
    Array.isArray(strip)
      ? strip.map((symbol) => String(symbol)).filter(Boolean)
      : []
  ));
}

function slotSymbolPool(config: SlotConfig) {
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const strip of slotReelStrips(config)) {
    for (const symbol of strip) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      symbols.push(symbol);
    }
  }
  return symbols;
}

function slotPayoutTable(config: SlotConfig) {
  const raw = config.symbol_payouts;
  const table: Record<string, Record<number, number>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return table;
  for (const [symbol, counts] of Object.entries(raw)) {
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) continue;
    table[symbol] = {};
    for (const [count, multiplier] of Object.entries(counts)) {
      table[symbol][Number(count)] = Number(multiplier);
    }
  }
  return table;
}

function slotScatterPayouts(config: SlotConfig) {
  const raw = config.scatter_payouts;
  const payouts: Record<number, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return payouts;
  for (const [count, multiplier] of Object.entries(raw)) {
    payouts[Number(count)] = Number(multiplier);
  }
  return payouts;
}

function slotFreeSpinTable(config: SlotConfig) {
  const raw = config.free_spins;
  const table: Record<number, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return table;
  for (const [count, amount] of Object.entries(raw)) {
    table[Number(count)] = Number(amount);
  }
  return table;
}

function roundPoints(value: number) {
  return Math.round(value);
}

function buildPaytable(cost: number, config: SlotConfig) {
  const entries: PaytableEntry[] = [];
  const payoutTable = slotPayoutTable(config);
  const scatterSymbol = String(config.scatter_symbol ?? 'scatter');

  for (const [symbol, countMap] of Object.entries(payoutTable)) {
    for (const [count, multiplier] of Object.entries(countMap).sort((left, right) => Number(right[0]) - Number(left[0]))) {
      entries.push({
        kind: 'line',
        symbol,
        count: Number(count),
        symbols: Array(Number(count)).fill(symbol),
        multiplier: Number(multiplier),
        payout: roundPoints(cost * Number(multiplier)),
        label: `${count} ${humanizeIdentifier(symbol)}`,
      });
    }
  }

  for (const [count, multiplier] of Object.entries(slotScatterPayouts(config)).sort((left, right) => Number(right[0]) - Number(left[0]))) {
    entries.push({
      kind: 'scatter',
      symbol: scatterSymbol,
      count: Number(count),
      symbols: Array(Number(count)).fill(scatterSymbol),
      multiplier: Number(multiplier),
      payout: roundPoints(cost * Number(multiplier)),
      freeSpins: slotFreeSpinTable(config)[Number(count)] ?? 0,
      label: `${count} Scatter`,
    });
  }

  return entries.toSorted((left, right) => {
    if (right.payout !== left.payout) return right.payout - left.payout;
    return right.count - left.count;
  });
}

function calculateMachineMetrics(config: SlotConfig) {
  return {
    hitRate: Number(config.hit_rate ?? 0),
    returnRate: Number(config.return_rate ?? 0),
  };
}

function visibleGridFromStrips(strips: string[][], rows: number, rng: RandomSource) {
  const reels: string[][] = [];
  const stops: number[] = [];

  for (const strip of strips) {
    if (strip.length === 0) {
      reels.push(Array(rows).fill(''));
      stops.push(0);
      continue;
    }

    const stop = rng.nextInt(strip.length);
    reels.push(Array.from({ length: rows }, (_, offset) => strip[(stop + offset) % strip.length]));
    stops.push(stop);
  }

  return { reels, stops };
}

function lineSymbolForEvaluation(lineSymbols: string[], wildSymbol: string, scatterSymbol: string) {
  for (const symbol of lineSymbols) {
    if (symbol !== wildSymbol && symbol !== scatterSymbol) return symbol;
  }
  return lineSymbols.length > 0 && lineSymbols.every((symbol) => symbol === wildSymbol) ? wildSymbol : null;
}

function evaluatePayline(
  line: number[],
  reels: string[][],
  cost: number,
  config: SlotConfig,
  lineIndex: number,
): LineWin | null {
  const wildSymbol = String(config.wild_symbol ?? 'wild');
  const scatterSymbol = String(config.scatter_symbol ?? 'scatter');
  const payoutTable = slotPayoutTable(config);
  const lineSymbols = line.map((rowIndex, reelIndex) => reels[reelIndex]?.[rowIndex] ?? '');
  const targetSymbol = lineSymbolForEvaluation(lineSymbols, wildSymbol, scatterSymbol);
  if (!targetSymbol) return null;

  let matchCount = 0;
  const positions: Array<[number, number]> = [];

  for (let reelIndex = 0; reelIndex < lineSymbols.length; reelIndex += 1) {
    const symbol = lineSymbols[reelIndex];
    if (symbol === scatterSymbol) break;
    if (symbol === targetSymbol || (symbol === wildSymbol && targetSymbol !== scatterSymbol)) {
      matchCount += 1;
      positions.push([reelIndex, line[reelIndex] ?? 0]);
      continue;
    }
    break;
  }

  const payouts = payoutTable[targetSymbol] ?? {};
  if (matchCount < 3 || !(matchCount in payouts)) return null;

  return {
    lineIndex,
    symbol: targetSymbol,
    count: matchCount,
    positions,
    symbols: lineSymbols,
    multiplier: payouts[matchCount],
    payout: roundPoints(cost * payouts[matchCount]),
  };
}

function evaluateScatter(reels: string[][], cost: number, config: SlotConfig): ScatterWin {
  const scatterSymbol = String(config.scatter_symbol ?? 'scatter');
  const positions: Array<[number, number]> = [];

  reels.forEach((reel, reelIndex) => {
    reel.forEach((symbol, rowIndex) => {
      if (symbol === scatterSymbol) {
        positions.push([reelIndex, rowIndex]);
      }
    });
  });

  const count = positions.length;
  const payouts = slotScatterPayouts(config);
  const freeSpins = slotFreeSpinTable(config);

  return {
    count,
    positions,
    payout: roundPoints(cost * (payouts[count] ?? 0)),
    freeSpinsAwarded: freeSpins[count] ?? 0,
    symbol: scatterSymbol,
  };
}

function evaluateSpin(game: CasinoGameRow, rng: RandomSource = defaultRandomSource()): EvaluatedSpin {
  const config = parseGameConfig(game.config_json);
  const strips = slotReelStrips(config);
  const rows = slotRows(config);
  const paylines = slotPaylines(config);
  const { reels, stops } = visibleGridFromStrips(strips, rows, rng);
  const lineWins = paylines
    .map((line, lineIndex) => evaluatePayline(line, reels, Number(game.cost), config, lineIndex))
    .filter((win): win is LineWin => Boolean(win));
  const scatter = evaluateScatter(reels, Number(game.cost), config);
  const payout = lineWins.reduce((total, win) => total + Number(win.payout ?? 0), 0) + Number(scatter.payout ?? 0);
  const centerRow = Math.min(1, Math.max(0, rows - 1));

  return {
    symbols: reels.map((reel) => reel[centerRow] ?? ''),
    grid: reels,
    stops,
    lineWins,
    scatter,
    payout,
  };
}

function normalizeSpinStorage(raw: unknown) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as SpinStoragePayload;
  }
  if (Array.isArray(raw)) {
    return { symbols: raw, grid: [raw] } as SpinStoragePayload;
  }
  return { symbols: [], grid: [] } as SpinStoragePayload;
}

function summarizeSlotOutcome(
  gameName: string,
  wager: number,
  lineWins: Array<Record<string, unknown>>,
  scatter: Record<string, unknown>,
  usedFreeSpin: boolean,
) {
  const freeSpinsAwarded = Number(scatter.freeSpinsAwarded ?? 0);
  if (freeSpinsAwarded > 0) {
    return {
      type: 'bonus',
      label: 'Bonus trigger',
      headline: `${gameName} opened a free-spin round.`,
      detail: `${Number(scatter.count ?? 0)} scatters awarded ${freeSpinsAwarded} free spins.`,
    };
  }

  if (lineWins.length > 0) {
    const topLine = [...lineWins].sort((left, right) => Number(right.payout ?? 0) - Number(left.payout ?? 0))[0];
    const count = Number(topLine.count ?? 0);
    const payout = Number(topLine.payout ?? 0);
    const isJackpot = count === 5 && payout >= wager * 10;
    return {
      type: isJackpot ? 'jackpot' : 'line_win',
      label: isJackpot ? 'Jackpot' : 'Line hit',
      headline: `${gameName} paid on line ${Number(topLine.lineIndex ?? 0) + 1}.`,
      detail: `${count} ${String(topLine.symbol ?? 'symbol')} symbols connected for ${payout} points.`,
    };
  }

  if (Number(scatter.count ?? 0) >= 2) {
    return {
      type: 'near_miss',
      label: 'Near miss',
      headline: `${gameName} almost triggered the feature.`,
      detail: `${Number(scatter.count ?? 0)} scatters landed. One more would have opened free spins.`,
    };
  }

  return {
    type: usedFreeSpin ? 'free_spin_miss' : 'miss',
    label: 'No win',
    headline: `${gameName} came up cold.`,
    detail: usedFreeSpin ? 'The free spin landed dry this round.' : 'No paylines connected on that spin.',
  };
}

function totalWageredToday(db: Database, userId: number) {
  const start = utcNow();
  start.setUTCHours(0, 0, 0, 0);
  const row = db.prepare(`
    SELECT COALESCE(SUM(wager), 0) AS total
    FROM casino_spins
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, utcIso(start)) as { total: number };
  return Number(row.total ?? 0);
}

function bonusStateMap(db: Database, userId: number) {
  const rows = db.prepare(`
    SELECT game_id, free_spins_remaining
    FROM casino_bonus_state
    WHERE user_id = ?
  `).all(userId) as BonusStateRow[];

  return new Map(rows.map((row) => [Number(row.game_id), Number(row.free_spins_remaining ?? 0)]));
}

function freeSpinsRemaining(db: Database, userId: number, gameId: number) {
  const row = db.prepare(`
    SELECT free_spins_remaining
    FROM casino_bonus_state
    WHERE user_id = ? AND game_id = ?
  `).get(userId, gameId) as { free_spins_remaining: number } | undefined;

  return Number(row?.free_spins_remaining ?? 0);
}

function setFreeSpinsRemaining(db: Database, userId: number, gameId: number, remaining: number) {
  db.prepare(`
    INSERT INTO casino_bonus_state (user_id, game_id, free_spins_remaining, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET
      free_spins_remaining = excluded.free_spins_remaining,
      updated_at = excluded.updated_at
  `).run(userId, gameId, Math.max(0, Number(remaining)), utcIso());
}

function lastSpinTime(db: Database, userId: number) {
  const row = db.prepare(`
    SELECT created_at
    FROM casino_spins
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(userId) as { created_at: string } | undefined;

  if (!row?.created_at) return null;
  const parsed = new Date(row.created_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function casinoDailyWagerCap() {
  const raw = envText('DAILY_WAGER_CAP');
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function dailyWagerStatus(db: Database, userId: number) {
  const dailyCap = casinoDailyWagerCap();
  const dailyWagered = totalWageredToday(db, userId);
  return {
    dailyWagered,
    dailyRemaining: dailyCap === null ? null : Math.max(0, dailyCap - dailyWagered),
    dailyCap,
  };
}

export function seedDefaultCasinoGames(db: Database) {
  const createdAt = utcIso();
  for (const game of DEFAULT_CASINO_GAMES) {
    db.prepare(`
      INSERT INTO casino_games (slug, name, cost, config_json, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        cost = excluded.cost,
        config_json = excluded.config_json,
        active = excluded.active
    `).run(game.slug, game.name, game.cost, JSON.stringify(game.config), createdAt);
  }

  const allowedSlugs = DEFAULT_CASINO_GAMES.map((game) => game.slug);
  const placeholders = allowedSlugs.map(() => '?').join(', ');
  db.prepare(`
    UPDATE casino_games
    SET active = CASE WHEN slug IN (${placeholders}) THEN 1 ELSE 0 END
  `).run(...allowedSlugs);
}

export function listCasinoGames(db: Database, userId: number | null = null) {
  const rows = db.prepare(`
    SELECT *
    FROM casino_games
    WHERE active = 1
    ORDER BY cost ASC, id ASC
  `).all() as CasinoGameRow[];
  const bonuses = userId === null ? new Map<number, number>() : bonusStateMap(db, userId);

  return rows.map((row) => {
    const config = parseGameConfig(row.config_json);
    const metrics = calculateMachineMetrics(config);
    const strips = slotReelStrips(config);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      cost: Number(row.cost),
      topPayout: Number(config.top_payout ?? row.cost),
      flavor: String(config.flavor ?? ''),
      volatility: String(config.volatility ?? 'Medium'),
      mood: String(config.mood ?? ''),
      jackpotLabel: String(config.jackpot_label ?? ''),
      accent: String(config.accent ?? '#9d7cf2'),
      rows: slotRows(config),
      reelCount: strips.length,
      paylinesCount: slotPaylines(config).length,
      reelSymbols: slotSymbolPool(config),
      paytable: buildPaytable(Number(row.cost), config),
      hitRate: metrics.hitRate,
      returnRate: metrics.returnRate,
      wildSymbol: String(config.wild_symbol ?? 'wild'),
      scatterSymbol: String(config.scatter_symbol ?? 'scatter'),
      freeSpinsRemaining: Number(bonuses.get(Number(row.id)) ?? 0),
    };
  });
}

export function spinCasinoGame(
  db: Database,
  userId: number,
  gameSlug: string,
  rng: RandomSource = defaultRandomSource(),
) {
  const normalizedSlug = String(gameSlug ?? '').trim();
  const game = db.prepare(`
    SELECT *
    FROM casino_games
    WHERE slug = ? AND active = 1
  `).get(normalizedSlug) as CasinoGameRow | undefined;

  if (!game) {
    throw new AppError('That machine does not exist.', 404);
  }

  const previousSpin = lastSpinTime(db, userId);
  if (previousSpin && (utcNow().getTime() - previousSpin.getTime()) / 1000 < SPIN_COOLDOWN_SECONDS) {
    throw new AppError('Slow down a little between spins.', 429);
  }

  const remainingBefore = freeSpinsRemaining(db, userId, Number(game.id));
  const usedFreeSpin = remainingBefore > 0;
  const baseWager = Number(game.cost);
  const wager = usedFreeSpin ? 0 : baseWager;
  const balance = getBalance(db, userId);

  if (!usedFreeSpin && balance < baseWager) {
    throw new AppError('You do not have enough points for that spin.', 400);
  }

  const dailyCap = casinoDailyWagerCap();
  if (!usedFreeSpin && dailyCap !== null && totalWageredToday(db, userId) + baseWager > dailyCap) {
    throw new AppError('You have reached the daily wager cap. Try again tomorrow.', 429);
  }

  const transaction = db.transaction(() => {
    if (wager > 0) {
      appendRewardLedger(db, userId, -wager, 'casino_wager', `Wagered on ${game.name}.`, {
        game_slug: normalizedSlug,
        cost: wager,
      });
    }

    const spin = evaluateSpin(game, rng);
    const freeSpinsAwarded = Number(spin.scatter.freeSpinsAwarded ?? 0);
    const remainingAfter = Math.max(0, remainingBefore - (usedFreeSpin ? 1 : 0)) + freeSpinsAwarded;
    setFreeSpinsRemaining(db, userId, Number(game.id), remainingAfter);

    db.prepare(`
      INSERT INTO casino_spins (user_id, game_id, wager, payout, symbols_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      game.id,
      wager,
      Number(spin.payout),
      JSON.stringify({
        symbols: spin.symbols,
        grid: spin.grid,
        stops: spin.stops,
        lineWins: spin.lineWins,
        scatter: spin.scatter,
        freeSpinsAwarded,
        freeSpinsRemaining: remainingAfter,
        usedFreeSpin,
      }),
      utcIso(),
    );

    if (Number(spin.payout) > 0) {
      appendRewardLedger(
        db,
        userId,
        Number(spin.payout),
        'casino_payout',
        `Hit a payout on ${game.name}${usedFreeSpin ? ' (free spin)' : ''}.`,
        {
          game_slug: normalizedSlug,
          symbols: spin.symbols,
          payout: Number(spin.payout),
          used_free_spin: usedFreeSpin,
        },
      );
    }

    return { spin, freeSpinsAwarded, remainingAfter };
  });

  const { spin, freeSpinsAwarded, remainingAfter } = transaction();
  const result = {
    game: game.name,
    gameSlug: normalizedSlug,
    symbols: spin.symbols,
    grid: spin.grid,
    lineWins: spin.lineWins,
    scatter: spin.scatter,
    wager,
    baseWager,
    payout: Number(spin.payout),
    net: Number(spin.payout) - wager,
    usedFreeSpin,
    freeSpinsAwarded,
    freeSpinsRemaining: remainingAfter,
    balance: getBalance(db, userId),
    outcome: summarizeSlotOutcome(
      game.name,
      wager || baseWager,
      spin.lineWins as Array<Record<string, unknown>>,
      spin.scatter as unknown as Record<string, unknown>,
      usedFreeSpin,
    ),
  };

  return {
    ...result,
    ...dailyWagerStatus(db, userId),
  };
}

export function recentSpins(db: Database, userId: number, limit = 5) {
  const rows = db.prepare(`
    SELECT casino_spins.*, casino_games.slug, casino_games.name, casino_games.cost
    FROM casino_spins
    JOIN casino_games ON casino_games.id = casino_spins.game_id
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, limit) as RecentSpinRow[];

  return rows.map((row) => {
    const payload = normalizeSpinStorage(jsonLoad(row.symbols_json, {}));
    const lineWins = Array.isArray(payload.lineWins) ? payload.lineWins as Array<Record<string, unknown>> : [];
    const scatter = payload.scatter && typeof payload.scatter === 'object' && !Array.isArray(payload.scatter)
      ? payload.scatter as Record<string, unknown>
      : { count: 0, payout: 0, freeSpinsAwarded: 0 };
    const usedFreeSpin = Boolean(payload.usedFreeSpin);

    return {
      id: row.id,
      game: row.name,
      gameSlug: row.slug,
      wager: Number(row.wager),
      baseWager: Number(row.cost),
      payout: Number(row.payout),
      net: Number(row.payout) - Number(row.wager),
      symbols: Array.isArray(payload.symbols) ? payload.symbols : [],
      grid: Array.isArray(payload.grid) ? payload.grid : [],
      lineWins,
      scatter,
      usedFreeSpin,
      freeSpinsAwarded: Number(payload.freeSpinsAwarded ?? 0),
      freeSpinsRemaining: Number(payload.freeSpinsRemaining ?? 0),
      createdAt: row.created_at,
      outcome: summarizeSlotOutcome(row.name, Number(row.wager) || 1, lineWins, scatter, usedFreeSpin),
    };
  });
}
