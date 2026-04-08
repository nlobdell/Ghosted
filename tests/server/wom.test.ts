import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import {
  COMPETITION,
  COMPETITIONS,
  FINISHED_SOTW_COMPETITION,
  GROUP_HISCORES,
  GROUP,
  GROUP_GAINS,
  OUTSIDER_GROUPS,
  PLAYER,
  PLAYER_GROUPS_NO_RANK,
  TITLE_VARIANT_SOTW_COMPETITION,
  installWomFetchMock,
} from './wom-fixtures';
import {
  getUserGameAccount,
  linkWomAccount,
  saveUserGameAccount,
  setWomCacheEntry,
  womCachedJson,
  womClanPayload,
  womCompetitionDetailPayload,
  womCompetitionsPayload,
  womGroupGainsPayload,
  womGroupHiscoresPayload,
  womGroupRosterPayload,
  womMePayload,
} from '@/lib/server/wom';

describe('wom server module', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment();
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds roster payloads with rank labels and member ordering', async () => {
    installWomFetchMock();

    const payload = await womGroupRosterPayload(context.db);

    expect(payload.group.memberCount).toBe(GROUP.memberCount);
    expect(payload.entries).toHaveLength(3);
    expect(payload.entries[0]?.player.username).toBe('vghosted');
    expect(payload.entries[0]?.roleKey).toBe('leader');
    expect(payload.entries[0]?.rankLabel).toBe('Leader');
    expect(payload.entries[1]?.rankLabel).toBe('Event Captain');
    expect(payload.entries[2]?.player.build).toBe('ironman');
  });

  it('links a WOM account and persists the user game account', async () => {
    installWomFetchMock();
    const userId = insertUser(context.db);

    const result = await linkWomAccount(context.db, { id: userId }, 'GhostedRSN');

    expect(result.linked).toBe(true);
    expect(result.playerId).toBe(PLAYER.id);
    expect(getUserGameAccount(context.db, userId)?.username).toBe(PLAYER.username);
  });

  it('updates an existing WOM link without duplicating rows', async () => {
    installWomFetchMock();
    const userId = insertUser(context.db);

    await linkWomAccount(context.db, { id: userId }, 'GhostedRSN');

    installWomFetchMock({
      'POST /players/GhostedRSN': { ...PLAYER, displayName: 'Ghosted RSN Updated' },
    });
    await linkWomAccount(context.db, { id: userId }, 'GhostedRSN');

    const row = getUserGameAccount(context.db, userId);
    const countRow = context.db.prepare('SELECT COUNT(*) AS count FROM user_game_accounts').get() as { count: number };
    expect(countRow.count).toBe(1);
    expect(row?.display_name).toBe('Ghosted RSN Updated');
  });

  it('rejects blank WOM usernames', async () => {
    const userId = insertUser(context.db);
    await expect(linkWomAccount(context.db, { id: userId }, '')).rejects.toMatchObject({
      message: 'Runescape username is required.',
      status: 400,
    });
  });

  it('rejects players outside the configured group', async () => {
    installWomFetchMock({
      'GET /players/GhostedRSN/groups': OUTSIDER_GROUPS,
    });
    const userId = insertUser(context.db);

    await expect(linkWomAccount(context.db, { id: userId }, 'GhostedRSN')).rejects.toMatchObject({
      message: 'That Wise Old Man player is not in the configured Ghosted group.',
      status: 400,
    });
  });

  it('prefers fresh WOM cache entries without hitting the network', async () => {
    const expected = { hello: 'world' };
    setWomCacheEntry(context.db, 'groups/123', expected);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const payload = await womCachedJson(context.db, '/groups/123');

    expect(payload).toEqual(expected);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns stale cache entries when the upstream request fails', async () => {
    const expected = { stale: true };
    setWomCacheEntry(context.db, 'groups/123', expected);
    context.db.prepare('UPDATE wom_cache SET expires_at = ? WHERE cache_key = ?').run('2000-01-01T00:00:00+00:00', 'groups/123');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream failed', { status: 502 })) as unknown as typeof fetch);

    const payload = await womCachedJson(context.db, '/groups/123');

    expect(payload).toEqual(expected);
  });

  it('builds the clan payload shape used by the hall pages', async () => {
    installWomFetchMock();
    insertUser(context.db);

    const payload = await womClanPayload(context.db);

    expect(payload.group.name).toBe('Ghosted');
    expect(payload.featuredHiscores.entries[0]?.player.displayName).toBe(PLAYER.displayName);
    expect(payload.featuredHiscores.entries[0]?.displayValue).toBe(GROUP_HISCORES[0]?.data.level);
    expect(payload.linkCoverage.trackedUsers).toBe(1);
    expect(payload.skillOfTheWeek?.mode).toBe('active');
    expect(payload.skillOfTheWeek?.competition.displayTitle).toBe('Agility Skill of the Week');
    expect(payload.skillOfTheWeek?.competition.participantCount).toBe(COMPETITION.participantCount);
    expect(payload.skillOfTheWeek?.standings[0]?.player.displayName).toBe(PLAYER.displayName);
  });

  it('normalizes WOM me membership when rank metadata is sparse', async () => {
    const userId = insertUser(context.db);
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    installWomFetchMock({
      'GET /players/GhostedRSN/groups': PLAYER_GROUPS_NO_RANK,
    });

    const payload = await womMePayload(context.db, { id: userId });

    expect(payload.membership?.rankLabel).toBe('Member');
  });

  it('normalizes hiscores and gains payloads', async () => {
    installWomFetchMock();

    const hiscores = await womGroupHiscoresPayload(context.db, 'overall', 5);
    const gains = await womGroupGainsPayload(context.db, 'overall', 'week', 5);

    expect(hiscores.metric).toBe('overall');
    expect(hiscores.entries[0]?.rank).toBe(17);
    expect(hiscores.entries[0]?.displayValue).toBe(GROUP_HISCORES[0]?.data.level);
    expect(hiscores.entries[0]?.valueKind).toBe('level');
    expect(hiscores.entries[0]?.experience).toBe(GROUP_HISCORES[0]?.data.experience);
    expect(gains.period).toBe('week');
    expect(gains.entries[0]?.gained).toBe(GROUP_GAINS[0]?.gained);
    expect(gains.entries[0]?.progress).toEqual({
      start: GROUP_GAINS[0]?.start,
      end: GROUP_GAINS[0]?.end,
      gained: GROUP_GAINS[0]?.gained,
    });
    expect(gains.entries[0]?.valueKind).toBe('gained');
  });

  it('returns competition detail and top history payloads', async () => {
    installWomFetchMock();

    const payload = await womCompetitionDetailPayload(context.db, COMPETITION.id);

    expect(payload.competition.id).toBe(COMPETITION.id);
    expect(payload.competition.participantCount).toBe(COMPETITION.participantCount);
    expect(payload.competition.displayTitle).toBe('Agility Skill of the Week');
    expect(payload.competition.participants[0]?.player.displayName).toBe(PLAYER.displayName);
    expect(payload.competition.participants[0]?.displayValue).toBe(4000);
    expect(payload.competition.participants[0]?.rank).toBe(1);
    expect(payload.topHistory[0]?.player.displayName).toBe(PLAYER.displayName);
  });

  it('classifies Skill of the Week title variants and preserves participant counts', async () => {
    installWomFetchMock();

    const payload = await womCompetitionsPayload(context.db, 12);

    expect(payload.competitions).toHaveLength(COMPETITIONS.length);
    expect(payload.competitions.find((entry) => entry.id === COMPETITION.id)?.displayTitle).toBe('Agility Skill of the Week');
    expect(payload.competitions.find((entry) => entry.id === FINISHED_SOTW_COMPETITION.id)?.displayTitle).toBe('Fishing Skill of the Week');
    expect(payload.competitions.find((entry) => entry.id === TITLE_VARIANT_SOTW_COMPETITION.id)?.displayTitle).toBe('Agility Skill of the Week');
    expect(payload.competitions.find((entry) => entry.id === COMPETITION.id)?.participantCount).toBe(COMPETITION.participantCount);
  });

  it('falls back to the latest finished Skill of the Week when no active board exists', async () => {
    installWomFetchMock({
      'GET /groups/123/competitions': [FINISHED_SOTW_COMPETITION, TITLE_VARIANT_SOTW_COMPETITION],
    });

    const payload = await womClanPayload(context.db);

    expect(payload.skillOfTheWeek?.mode).toBe('latest_finished');
    expect(payload.skillOfTheWeek?.competition.id).toBe(FINISHED_SOTW_COMPETITION.id);
    expect(payload.skillOfTheWeek?.competition.displayTitle).toBe('Fishing Skill of the Week');
  });
});
