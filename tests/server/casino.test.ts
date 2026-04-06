import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { casinoDailyWagerCap, dailyWagerStatus, listCasinoGames, recentSpins, spinCasinoGame } from '@/lib/server/casino';

function insertTestCasinoGame(db: Database, slug = 'test-machine') {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO casino_games (slug, name, cost, config_json, active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(
    slug,
    'Test Machine',
    20,
    JSON.stringify({
      rows: 1,
      paylines: [[0, 0, 0]],
      reel_strips: [
        ['wild', 'coin', 'coin'],
        ['wild', 'coin', 'coin'],
        ['wild', 'coin', 'coin'],
      ],
      symbol_payouts: {
        wild: { 3: 5 },
        coin: { 3: 1 },
      },
      wild_symbol: 'wild',
      scatter_symbol: 'scatter',
      scatter_payouts: {},
      free_spins: {},
      top_payout: 100,
      flavor: 'Deterministic test slot.',
      volatility: 'Low',
      mood: 'Predictable',
      jackpot_label: '3 Wilds x5',
      accent: '#00ffaa',
      hit_rate: 1,
      return_rate: 5,
    }),
    createdAt,
  );
}

function setBonusState(db: Database, userId: number, slug: string, freeSpinsRemaining: number) {
  const row = db.prepare('SELECT id FROM casino_games WHERE slug = ?').get(slug) as { id: number } | undefined;
  if (!row) throw new Error(`Missing casino game for slug ${slug}`);
  db.prepare(`
    INSERT INTO casino_bonus_state (user_id, game_id, free_spins_remaining, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET
      free_spins_remaining = excluded.free_spins_remaining,
      updated_at = excluded.updated_at
  `).run(userId, row.id, freeSpinsRemaining, new Date().toISOString());
}

function fixedRng(...values: number[]) {
  let index = 0;
  return {
    nextInt(maxExclusive: number) {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;
      return ((value % maxExclusive) + maxExclusive) % maxExclusive;
    },
  };
}

describe('casino server module', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({ DAILY_WAGER_CAP: '150' });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
  });

  it('lists active games in ascending cost order and exposes the daily wager cap', () => {
    const payload = listCasinoGames(context.db);

    expect(payload.map((game) => game.slug)).toEqual(['jigsaw-jackpot', 'ghost-lanterns', 'royal-heist']);
    expect(payload[0]).toMatchObject({
      slug: 'jigsaw-jackpot',
      cost: 20,
      freeSpinsRemaining: 0,
    });
    expect(casinoDailyWagerCap()).toBe(150);
  });

  it('deducts the wager, records the spin, updates the ledger, and returns the spin envelope', () => {
    const userId = insertUser(context.db);
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');
    insertTestCasinoGame(context.db);

    const result = spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0));
    const spinRow = context.db.prepare('SELECT wager, payout FROM casino_spins ORDER BY id DESC LIMIT 1').get() as {
      wager: number;
      payout: number;
    };
    const ledgerRows = context.db.prepare(`
      SELECT entry_type, amount
      FROM reward_ledger
      WHERE user_id = ?
      ORDER BY id ASC
    `).all(userId) as Array<{ entry_type: string; amount: number }>;

    expect(result).toMatchObject({
      game: 'Test Machine',
      gameSlug: 'test-machine',
      wager: 20,
      baseWager: 20,
      payout: 100,
      net: 80,
      usedFreeSpin: false,
      freeSpinsAwarded: 0,
      freeSpinsRemaining: 0,
      balance: 280,
      dailyWagered: 20,
      dailyRemaining: 130,
      dailyCap: 150,
    });
    expect(spinRow).toEqual({ wager: 20, payout: 100 });
    expect(ledgerRows).toEqual([
      { entry_type: 'welcome_bonus', amount: 200 },
      { entry_type: 'casino_wager', amount: -20 },
      { entry_type: 'casino_payout', amount: 100 },
    ]);
  });

  it('uses free spins at zero wager, decrements the bonus state, and still records the payout', () => {
    const userId = insertUser(context.db);
    insertTestCasinoGame(context.db);
    setBonusState(context.db, userId, 'test-machine', 2);

    const result = spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0));
    const bonusRow = context.db.prepare(`
      SELECT free_spins_remaining
      FROM casino_bonus_state
      WHERE user_id = ?
    `).get(userId) as { free_spins_remaining: number };
    const ledgerRows = context.db.prepare(`
      SELECT entry_type, amount
      FROM reward_ledger
      WHERE user_id = ?
      ORDER BY id ASC
    `).all(userId) as Array<{ entry_type: string; amount: number }>;

    expect(result).toMatchObject({
      wager: 0,
      baseWager: 20,
      payout: 100,
      net: 100,
      usedFreeSpin: true,
      freeSpinsRemaining: 1,
      balance: 100,
      dailyWagered: 0,
    });
    expect(bonusRow.free_spins_remaining).toBe(1);
    expect(ledgerRows).toEqual([{ entry_type: 'casino_payout', amount: 100 }]);
  });

  it('rejects spins during the cooldown window', () => {
    const userId = insertUser(context.db);
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');
    insertTestCasinoGame(context.db);

    spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0));

    expect(() => spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0))).toThrowError(
      'Slow down a little between spins.',
    );
  });

  it('rejects spins that would exceed the daily wager cap', () => {
    cleanupServerTestEnvironment(context);
    context = setupServerTestEnvironment({ DAILY_WAGER_CAP: '10' });
    const userId = insertUser(context.db);
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');
    insertTestCasinoGame(context.db);

    expect(() => spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0))).toThrowError(
      'You have reached the daily wager cap. Try again tomorrow.',
    );
    expect(dailyWagerStatus(context.db, userId)).toEqual({
      dailyWagered: 0,
      dailyRemaining: 10,
      dailyCap: 10,
    });
  });

  it('rejects spins when the balance is too low', () => {
    const userId = insertUser(context.db);
    insertTestCasinoGame(context.db);

    expect(() => spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0))).toThrowError(
      'You do not have enough points for that spin.',
    );
  });

  it('rejects spins for unknown machines', () => {
    const userId = insertUser(context.db);

    expect(() => spinCasinoGame(context.db, userId, 'missing-machine', fixedRng(0, 0, 0))).toThrowError(
      'That machine does not exist.',
    );
  });

  it('shares recent spin summaries with rewards consumers', () => {
    const userId = insertUser(context.db);
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');
    insertTestCasinoGame(context.db);

    spinCasinoGame(context.db, userId, 'test-machine', fixedRng(0, 0, 0));
    const spins = recentSpins(context.db, userId, 5);

    expect(spins).toHaveLength(1);
    expect(spins[0]).toMatchObject({
      game: 'Test Machine',
      gameSlug: 'test-machine',
      wager: 20,
      baseWager: 20,
      payout: 100,
      net: 80,
      usedFreeSpin: false,
    });
  });
});
