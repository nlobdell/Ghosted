import { vi } from 'vitest';

export const PLAYER = {
  id: 555,
  username: 'GhostedRSN',
  displayName: 'Ghosted RSN',
  type: 'regular',
  build: 'main',
  status: 'active',
  exp: 123456789,
  ehp: 432.1,
  ehb: 12.3,
  updatedAt: '2026-04-02T01:00:00Z',
  lastChangedAt: '2026-04-02T00:30:00Z',
  lastImportedAt: '2026-04-02T01:05:00Z',
};

export const PLAYER_GROUPS = [
  {
    groupId: 123,
    group: { id: 123, name: 'Ghosted' },
    role: 'event_captain',
    rankOrder: 4,
  },
];

export const PLAYER_GROUPS_NO_RANK = [
  {
    groupId: 123,
    group: { id: 123, name: 'Ghosted' },
    role: 'member',
  },
];

export const OUTSIDER_GROUPS = [
  {
    groupId: 999,
    group: { id: 999, name: 'Elsewhere' },
    role: 'member',
  },
];

export const GROUP = {
  id: 123,
  name: 'Ghosted',
  clanChat: 'Ghosted',
  description: 'Ghosted clan',
  homeworld: 421,
  memberCount: 77,
  score: 9001,
  verified: true,
  updatedAt: '2026-04-02T02:00:00Z',
  memberships: [
    {
      playerId: 1,
      groupId: 123,
      role: 'leader',
      rankOrder: 1,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-02T00:00:00Z',
      player: {
        id: 1,
        username: 'vghosted',
        displayName: 'vghosted',
        type: 'regular',
        build: 'main',
        status: 'active',
        exp: 300000000,
        updatedAt: '2026-04-02T00:00:00Z',
      },
    },
    {
      playerId: 2,
      groupId: 123,
      role: 'event_captain',
      rankOrder: 4,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-02T00:00:00Z',
      player: {
        id: 2,
        username: 'GhostedRSN',
        displayName: 'Ghosted RSN',
        type: 'regular',
        build: 'main',
        status: 'active',
        exp: 123456789,
        updatedAt: '2026-04-02T00:00:00Z',
      },
    },
    {
      playerId: 3,
      groupId: 123,
      role: 'member',
      rankOrder: 99,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-02T00:00:00Z',
      player: {
        id: 3,
        username: 'newrecruit',
        displayName: 'New Recruit',
        type: 'regular',
        build: 'ironman',
        status: 'active',
        exp: 50000000,
        updatedAt: '2026-04-02T00:00:00Z',
      },
    },
  ],
};

export const GROUP_STATS = {
  maxedCombatCount: 4,
  maxedTotalCount: 2,
  maxed200msCount: 1,
  averageStats: {
    data: {
      skills: {
        overall: {
          level: 1920,
          experience: 87654321,
        },
      },
      computed: {
        ehp: { value: 321.5 },
        ehb: { value: 45.7 },
      },
    },
  },
};

export const PLAYER_REF = {
  id: PLAYER.id,
  username: PLAYER.username,
  displayName: PLAYER.displayName,
};

export const GROUP_ACHIEVEMENTS = [
  {
    name: '99 Magic',
    metric: 'magic',
    measure: 'experience',
    threshold: 13034431,
    createdAt: '2026-04-02T00:00:00Z',
    player: PLAYER_REF,
  },
];

export const GROUP_ACTIVITY = [
  {
    type: 'joined',
    createdAt: '2026-04-02T00:00:00Z',
    player: PLAYER_REF,
  },
];

export const GROUP_HISCORES = [
  {
    player: PLAYER_REF,
    data: {
      rank: 17,
      experience: 123456789,
      level: 2227,
    },
  },
];

export const GROUP_GAINS = [
  {
    player: PLAYER_REF,
    gained: 987654,
    start: 50000000,
    end: 50987654,
  },
];

export const COMPETITION = {
  id: 42,
  title: 'Ghosted SOTW',
  metric: 'agility',
  type: 'classic',
  startsAt: '2020-04-01T00:00:00Z',
  endsAt: '2099-04-08T00:00:00Z',
  groupId: 123,
  score: 900,
  participantCount: 472,
};

export const FINISHED_SOTW_COMPETITION = {
  id: 43,
  title: 'Fishing - Skill of the Week',
  metric: 'fishing',
  type: 'classic',
  startsAt: '2025-03-25T00:00:00Z',
  endsAt: '2025-04-01T00:00:00Z',
  groupId: 123,
  score: 875,
  participantCount: 310,
};

export const TITLE_VARIANT_SOTW_COMPETITION = {
  id: 44,
  title: 'Agility Skill of the Week',
  metric: 'agility',
  type: 'classic',
  startsAt: '2025-03-18T00:00:00Z',
  endsAt: '2025-03-25T00:00:00Z',
  groupId: 123,
  score: 860,
  participantCount: 288,
};

export const UPCOMING_COMPETITION = {
  id: 45,
  title: 'Boss of the Weekend',
  metric: 'zulrah',
  type: 'classic',
  startsAt: '2099-05-10T00:00:00Z',
  endsAt: '2099-05-12T00:00:00Z',
  groupId: 123,
  score: 500,
  participantCount: 96,
};

export const COMPETITION_DETAIL = {
  ...COMPETITION,
  participations: [
    {
      player: PLAYER_REF,
      progress: {
        start: 1000,
        end: 5000,
        gained: 4000,
      },
      levels: {
        start: 70,
        end: 73,
        gained: 3,
      },
      updatedAt: '2026-04-02T01:00:00Z',
    },
    {
      player: {
        id: 556,
        username: 'AnotherGhost',
        displayName: 'Another Ghost',
      },
      progress: {
        start: 900,
        end: 4100,
        gained: 3200,
      },
      levels: {
        start: 68,
        end: 70,
        gained: 2,
      },
      updatedAt: '2026-04-02T01:05:00Z',
    },
  ],
};

export const FINISHED_SOTW_COMPETITION_DETAIL = {
  ...FINISHED_SOTW_COMPETITION,
  participations: [
    {
      player: PLAYER_REF,
      progress: {
        start: 2000,
        end: 6200,
        gained: 4200,
      },
      levels: {
        start: 65,
        end: 68,
        gained: 3,
      },
      updatedAt: '2026-04-01T01:00:00Z',
    },
  ],
};

export const COMPETITIONS = [
  COMPETITION,
  UPCOMING_COMPETITION,
  FINISHED_SOTW_COMPETITION,
  TITLE_VARIANT_SOTW_COMPETITION,
];

export const TOP_HISTORY = [
  {
    player: PLAYER_REF,
    history: [{ value: 1000, date: '2026-04-01T00:00:00Z' }],
  },
];

type OverrideValue =
  | Response
  | Error
  | unknown
  | ((context: { key: string; method: string; path: string; url: URL }) => Response | Error | unknown);

type ResponseOverrides = Record<string, OverrideValue>;

const DEFAULT_RESPONSES: ResponseOverrides = {
  'GET /groups/123': GROUP,
  'GET /groups/123/statistics': GROUP_STATS,
  'GET /groups/123/achievements': GROUP_ACHIEVEMENTS,
  'GET /groups/123/activity': GROUP_ACTIVITY,
  'GET /groups/123/hiscores': GROUP_HISCORES,
  'GET /groups/123/gained': GROUP_GAINS,
  'GET /groups/123/competitions': COMPETITIONS,
  'GET /players/id/555': PLAYER,
  'GET /players/GhostedRSN/groups': PLAYER_GROUPS,
  'GET /players/GhostedRSN/gained': { skills: { overall: { gained: 987654 } } },
  'GET /players/GhostedRSN/achievements': GROUP_ACHIEVEMENTS,
  'GET /players/GhostedRSN/competitions/standings': [COMPETITION],
  'GET /competitions/42': COMPETITION_DETAIL,
  'GET /competitions/43': FINISHED_SOTW_COMPETITION_DETAIL,
  'GET /competitions/42/top-history': TOP_HISTORY,
  'POST /players/GhostedRSN': PLAYER,
};

function resolveRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return {
      method: init?.method ?? input.method,
      url: new URL(input.url),
    };
  }

  if (input instanceof URL) {
    return {
      method: init?.method ?? 'GET',
      url: input,
    };
  }

  return {
    method: init?.method ?? 'GET',
    url: new URL(String(input)),
  };
}

export function installWomFetchMock(overrides: ResponseOverrides = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { method, url } = resolveRequest(input, init);
    const path = url.pathname.replace(/^\/v2/, '');
    const key = `${method.toUpperCase()} ${path}`;
    const override = key in overrides ? overrides[key] : DEFAULT_RESPONSES[key];
    const value = typeof override === 'function'
      ? override({ key, method: method.toUpperCase(), path, url })
      : override;

    if (value instanceof Response) return value;
    if (value instanceof Error) throw value;
    if (value === undefined) {
      return new Response(`Unhandled WOM path in test: ${key}`, { status: 404 });
    }

    return Response.json(value);
  });

  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}
