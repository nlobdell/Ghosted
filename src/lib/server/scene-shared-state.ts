import 'server-only';

import type Database from 'better-sqlite3';
import {
  advanceGhostlingSceneEntity,
  createGhostlingSceneMotionState,
  preferredGhostlingScenePointKey,
  resolveGhostlingSceneProfile,
  rehomeGhostlingSceneEntity,
  type GhostlingSceneMotionState,
} from '@/lib/ghostling-scene';
import {
  createDefaultGhostlingSceneTuningSpec,
  type GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';
import { SHARED_COMMONS_WORLD, type GhostlingWorldSpec } from '@/lib/ghostling-world';
import type {
  ScenePresenceMember,
  ScenePresencePayloadSource,
  SceneSharedEntityState,
  SceneSharedSnapshot,
} from '@/lib/types';

const LIVE_ACTIVE_MS = 3_200;
const SHARED_SCENE_VERSION = 1;
const HERO_SCENE_PROFILE_WIDTH = 1200;
const HERO_SCENE_VARIANT = 'hero';
const HERO_SCENE_KEY = 'hero:shared-commons';
const HERO_SCENE_FALLBACK_MEMBER: ScenePresenceMember = {
  key: 'fallback:house',
  userId: null,
  username: 'Ghosted House',
  displayName: 'Ghosted House',
  source: 'fallback',
  activity: {
    firstSeenAt: new Date(0).toISOString(),
    lastSeenAt: new Date(0).toISOString(),
    freshness: 'steady',
    strength: 'medium',
  },
};

type SharedHeroSceneRuntimeState = {
  updatedAt: number;
  entities: Map<string, SceneSharedEntityState>;
  liveCount: number;
  payloadSource: ScenePresencePayloadSource;
};

let sharedHeroSceneState: SharedHeroSceneRuntimeState | null = null;

type SceneSharedSnapshotRow = {
  scene_key: string;
  version: number;
  variant: 'hero';
  width: number;
  height: number;
  saved_at: number;
  payload_source: ScenePresencePayloadSource;
  live_count: number;
  entities_json: string;
  updated_at: string;
};

export function resetSharedSceneStateForTests() {
  sharedHeroSceneState = null;
}

export function resetSharedHeroSceneSnapshot(
  db: Database.Database,
) {
  sharedHeroSceneState = null;
  db.prepare(`
    DELETE FROM scene_shared_snapshots
    WHERE scene_key = ?
  `).run(HERO_SCENE_KEY);
}

function loadSharedHeroSceneState(
  db: Database.Database,
): SharedHeroSceneRuntimeState | null {
  const row = db.prepare(`
    SELECT scene_key, version, variant, width, height, saved_at, payload_source, live_count, entities_json, updated_at
    FROM scene_shared_snapshots
    WHERE scene_key = ?
    LIMIT 1
  `).get(HERO_SCENE_KEY) as SceneSharedSnapshotRow | undefined;

  if (!row) return null;

  try {
    const entities = JSON.parse(row.entities_json) as SceneSharedEntityState[];
    return {
      updatedAt: row.saved_at,
      entities: new Map(entities.map((entity) => [entity.key, entity])),
      liveCount: row.live_count,
      payloadSource: row.payload_source,
    };
  } catch {
    return null;
  }
}

function resolveSharedHeroSceneState(
  db: Database.Database,
  now: number,
): SharedHeroSceneRuntimeState {
  const persisted = loadSharedHeroSceneState(db);
  if (!sharedHeroSceneState) {
    sharedHeroSceneState = persisted ?? {
      updatedAt: now,
      entities: new Map(),
      liveCount: 0,
      payloadSource: 'empty',
    };
    return sharedHeroSceneState;
  }

  if (persisted && persisted.updatedAt > sharedHeroSceneState.updatedAt) {
    sharedHeroSceneState = persisted;
  }

  return sharedHeroSceneState;
}

function persistSharedHeroSceneState(
  db: Database.Database,
  state: SharedHeroSceneRuntimeState,
  world: GhostlingWorldSpec,
) {
  db.prepare(`
    INSERT INTO scene_shared_snapshots (
      scene_key,
      version,
      variant,
      width,
      height,
      saved_at,
      payload_source,
      live_count,
      entities_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scene_key) DO UPDATE SET
      version = excluded.version,
      variant = excluded.variant,
      width = excluded.width,
      height = excluded.height,
      saved_at = excluded.saved_at,
      payload_source = excluded.payload_source,
      live_count = excluded.live_count,
      entities_json = excluded.entities_json,
      updated_at = excluded.updated_at
  `).run(
    HERO_SCENE_KEY,
    SHARED_SCENE_VERSION,
    HERO_SCENE_VARIANT,
    world.sourceWidth,
    world.sourceHeight,
    state.updatedAt,
    state.payloadSource,
    state.liveCount,
    JSON.stringify(Array.from(state.entities.values())),
    new Date(state.updatedAt).toISOString(),
  );
}

function snapshotMembers(members: ScenePresenceMember[]): ScenePresenceMember[] {
  return members.length > 0 ? members : [HERO_SCENE_FALLBACK_MEMBER];
}

function advanceSharedHeroSceneEntities(
  entities: Map<string, SceneSharedEntityState>,
  elapsedMs: number,
  world: GhostlingWorldSpec,
  tuning: GhostlingSceneTuningSpec,
) {
  if (elapsedMs <= 0 || entities.size === 0) return;

  const profile = resolveGhostlingSceneProfile(HERO_SCENE_PROFILE_WIDTH, HERO_SCENE_VARIANT, {}, tuning, world);

  let remainingMs = elapsedMs;
  while (remainingMs > 0) {
    const stepMs = Math.min(remainingMs, 100);
    const peerPositions = Array.from(entities.values()).map((entity) => ({
      key: entity.key,
      x: entity.x,
      y: entity.y,
      targetX: entity.targetX,
      targetY: entity.targetY,
      pointKey: entity.pointKey,
      scaleTier: entity.scaleTier,
      renderScale: entity.renderScale,
      actorMetrics: entity.actorMetrics,
    }));

    for (const entity of entities.values()) {
      const next = advanceGhostlingSceneEntity(entity as GhostlingSceneMotionState, {
        dtMs: stepMs,
        world,
        profile,
        peers: peerPositions,
        fallback: entity.fallback,
        source: entity.source,
      });
      Object.assign(entity, next);
    }

    remainingMs -= stepMs;
  }
}

function createSharedHeroSceneEntity(
  member: ScenePresenceMember,
  memberIndex: number,
  entities: Map<string, SceneSharedEntityState>,
  now: number,
  world: GhostlingWorldSpec,
  tuning: GhostlingSceneTuningSpec,
) {
  const profile = resolveGhostlingSceneProfile(HERO_SCENE_PROFILE_WIDTH, HERO_SCENE_VARIANT, {}, tuning, world);
  const preferredPointKey = preferredGhostlingScenePointKey(
    profile,
    memberIndex,
    member.source === 'fallback',
    member.source,
  );
  const motion = createGhostlingSceneMotionState(
    member.key,
    world,
    profile,
    preferredPointKey,
      {
        fallback: member.source === 'fallback',
        source: member.source,
        peers: Array.from(entities.values()).map((entity) => ({
        key: entity.key,
        x: entity.x,
        y: entity.y,
        targetX: entity.targetX,
        targetY: entity.targetY,
        pointKey: entity.pointKey,
        scaleTier: entity.scaleTier,
        renderScale: entity.renderScale,
        actorMetrics: entity.actorMetrics,
      })),
      actorMetrics: member.companion?.actorMetrics,
    },
  );

  return {
    key: motion.key,
    x: motion.x,
    y: motion.y,
    targetX: motion.targetX,
    targetY: motion.targetY,
    speed: motion.speed,
    velocityX: motion.velocityX,
    velocityY: motion.velocityY,
    pauseRemainingMs: motion.pauseRemainingMs,
    phaseRemainingMs: motion.phaseRemainingMs,
    targetSerial: motion.targetSerial,
    safeZoneKey: motion.safeZoneKey,
    pointKey: motion.pointKey,
    scaleTier: motion.scaleTier,
    renderScale: motion.renderScale,
    movementPhase: motion.movementPhase,
    facingLeft: motion.facingLeft,
    opacity: 1,
    jammedMs: 0,
    actorMetrics: motion.actorMetrics,
    fallback: member.source === 'fallback',
    source: member.source,
    activeUntilTs: member.activity.freshness === 'new' ? now + LIVE_ACTIVE_MS : 0,
    lastSeenSignature: `${member.activity.lastSeenAt}:${member.source}`,
  } satisfies SceneSharedEntityState;
}

function syncSharedHeroSceneMembers(
  entities: Map<string, SceneSharedEntityState>,
  members: ScenePresenceMember[],
  now: number,
  world: GhostlingWorldSpec,
  tuning: GhostlingSceneTuningSpec,
) {
  const effectiveMembers = snapshotMembers(members);
  const incomingKeys = new Set(effectiveMembers.map((member) => member.key));

  for (const key of entities.keys()) {
    if (!incomingKeys.has(key)) {
      entities.delete(key);
    }
  }

  for (const [memberIndex, member] of effectiveMembers.entries()) {
    const signature = `${member.activity.lastSeenAt}:${member.source}`;
    const existing = entities.get(member.key);
    const profile = resolveGhostlingSceneProfile(HERO_SCENE_PROFILE_WIDTH, HERO_SCENE_VARIANT, {}, tuning, world);
    const preferredPointKey = preferredGhostlingScenePointKey(
      profile,
      memberIndex,
      member.source === 'fallback',
      member.source,
    );

    if (!existing) {
      entities.set(member.key, createSharedHeroSceneEntity(member, memberIndex, entities, now, world, tuning));
      continue;
    }

    if (!profile.allowedPointKeys.has(existing.pointKey) && !existing.fallback) {
      Object.assign(
        existing,
        rehomeGhostlingSceneEntity(
          existing as GhostlingSceneMotionState,
          world,
          profile,
          preferredPointKey,
          {
            fallback: member.source === 'fallback',
            source: member.source,
            peers: Array.from(entities.values())
              .filter((entity) => entity.key !== existing.key)
              .map((entity) => ({
                key: entity.key,
                x: entity.x,
                y: entity.y,
                targetX: entity.targetX,
                targetY: entity.targetY,
                pointKey: entity.pointKey,
                scaleTier: entity.scaleTier,
                renderScale: entity.renderScale,
                actorMetrics: entity.actorMetrics,
              })),
          },
        ),
      );
    }

    existing.fallback = member.source === 'fallback';
    existing.source = member.source;
    existing.actorMetrics = member.companion?.actorMetrics ?? existing.actorMetrics;
    if (existing.lastSeenSignature !== signature && member.activity.freshness === 'new') {
      existing.activeUntilTs = now + LIVE_ACTIVE_MS;
    }
    existing.lastSeenSignature = signature;
  }
}

export function buildSharedHeroSceneSnapshot(
  db: Database.Database,
  members: ScenePresenceMember[],
  payloadSource: ScenePresencePayloadSource,
  now: number,
  world: GhostlingWorldSpec = SHARED_COMMONS_WORLD,
  tuning: GhostlingSceneTuningSpec = createDefaultGhostlingSceneTuningSpec(),
) {
  sharedHeroSceneState = resolveSharedHeroSceneState(db, now);

  advanceSharedHeroSceneEntities(
    sharedHeroSceneState.entities,
    Math.max(0, now - sharedHeroSceneState.updatedAt),
    world,
    tuning,
  );
  syncSharedHeroSceneMembers(sharedHeroSceneState.entities, members, now, world, tuning);

  sharedHeroSceneState.updatedAt = now;
  sharedHeroSceneState.liveCount = members.length;
  sharedHeroSceneState.payloadSource = payloadSource;
  persistSharedHeroSceneState(db, sharedHeroSceneState, world);

  return {
    version: SHARED_SCENE_VERSION,
    variant: HERO_SCENE_VARIANT,
    width: world.sourceWidth,
    height: world.sourceHeight,
    savedAt: now,
    payloadSource,
    liveCount: members.length,
    entities: Array.from(sharedHeroSceneState.entities.values()),
  } satisfies SceneSharedSnapshot;
}
