import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
const { authMock, cookiesMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { GET as getCasinoGamesRoute } from '@/app/api/casino/games/route';
import { POST as postCasinoSpinRoute } from '@/app/api/casino/spin/route';
import { buildRewardsPayload } from '@/lib/server/ghosted-api';

function insertTestCasinoGame(db: Database, slug = 'route-test-machine') {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO casino_games (slug, name, cost, config_json, active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(
    slug,
    'Route Test Machine',
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
      flavor: 'Deterministic route slot.',
      volatility: 'Low',
      mood: 'Predictable',
      jackpot_label: '3 Wilds x5',
      accent: '#ffaa00',
      hit_rate: 1,
      return_rate: 5,
    }),
    createdAt,
  );
}

describe('casino route handlers', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment({ DAILY_WAGER_CAP: '150' });
    vi.restoreAllMocks();
    authMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns games for signed-out requests', async () => {
    authMock.mockResolvedValue(null);

    const response = await getCasinoGamesRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dailyWagerCap).toBe(150);
    expect(payload.games[0]).toMatchObject({
      slug: 'jigsaw-jackpot',
      freeSpinsRemaining: 0,
    });
  });

  it('returns games with user free-spin state when authenticated', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    const row = context.db.prepare('SELECT id FROM casino_games WHERE slug = ?').get('jigsaw-jackpot') as { id: number };
    context.db.prepare(`
      INSERT INTO casino_bonus_state (user_id, game_id, free_spins_remaining, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, row.id, 4, new Date().toISOString());

    const response = await getCasinoGamesRoute();
    const payload = await response.json();
    const game = payload.games.find((entry: { slug: string }) => entry.slug === 'jigsaw-jackpot');

    expect(response.status).toBe(200);
    expect(game?.freeSpinsRemaining).toBe(4);
  });

  it('returns 401 for unauthenticated spins', async () => {
    authMock.mockResolvedValue(null);

    const response = await postCasinoSpinRoute(new Request('http://localhost/api/casino/spin', {
      method: 'POST',
      body: JSON.stringify({ gameSlug: 'jigsaw-jackpot' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('returns the expected success envelope for a valid spin and keeps rewards in sync', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');
    insertTestCasinoGame(context.db);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const response = await postCasinoSpinRoute(new Request('http://localhost/api/casino/spin', {
      method: 'POST',
      body: JSON.stringify({ gameSlug: 'route-test-machine' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const rewards = await buildRewardsPayload();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result).toMatchObject({
      gameSlug: 'route-test-machine',
      game: 'Route Test Machine',
      wager: 20,
      baseWager: 20,
      payout: 100,
      net: 80,
      dailyWagered: 20,
      dailyRemaining: 130,
      dailyCap: 150,
    });
    expect(rewards.dailyWagered).toBe(20);
    expect(rewards.spins[0]).toMatchObject({
      gameSlug: 'route-test-machine',
      wager: 20,
      payout: 100,
    });
  });

  it('returns 400 when the player lacks funds', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    insertTestCasinoGame(context.db);

    const response = await postCasinoSpinRoute(new Request('http://localhost/api/casino/spin', {
      method: 'POST',
      body: JSON.stringify({ gameSlug: 'route-test-machine' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'You do not have enough points for that spin.' });
  });

  it('returns 404 for unknown machines', async () => {
    const userId = insertUser(context.db);
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial balance');

    const response = await postCasinoSpinRoute(new Request('http://localhost/api/casino/spin', {
      method: 'POST',
      body: JSON.stringify({ gameSlug: 'missing-machine' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'That machine does not exist.' });
  });
});
