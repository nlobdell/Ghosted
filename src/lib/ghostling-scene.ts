import {
  resolveGhostlingSceneBucket,
  SHARED_COMMONS_WORLD,
  type GhostlingSceneDensityBucket,
  type GhostlingWorldPoint,
  type GhostlingWorldSafeZone,
  type GhostlingWorldScaleTier,
  type GhostlingWorldSpec,
} from '@/lib/ghostling-world';
import {
  DEFAULT_GHOSTLING_ACTOR_METRICS,
  scaleGhostlingFrameSize,
  scaledGhostlingFootprintForMetrics,
  scaledGhostlingVisibleExtents,
} from '@/lib/ghostling-actor';
import {
  createDefaultGhostlingSceneTuningSpec,
  resolveGhostlingSceneTuning,
  type GhostlingResolvedSceneTuning,
  type GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';
import type { CompanionActorMetrics, GhostlingMovementPhase } from '@/lib/types';

export type GhostlingSceneVariant = 'hero' | 'section';
export type GhostlingSceneFallbackMode = 'single' | 'crowd';
export type GhostlingSceneDensityCaps = Partial<Record<GhostlingSceneDensityBucket, number>>;

export type GhostlingSceneProfile = GhostlingResolvedSceneTuning;

export type GhostlingSceneMotionState = {
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
  scaleTier: GhostlingWorldScaleTier;
  renderScale: number;
  movementPhase: GhostlingMovementPhase;
  facingLeft: boolean;
  opacity: number;
  jammedMs: number;
  actorMetrics: CompanionActorMetrics;
};

export type GhostlingScenePeerState = Pick<
  GhostlingSceneMotionState,
  'key' | 'x' | 'y' | 'pointKey' | 'scaleTier' | 'renderScale' | 'actorMetrics'
> & {
  targetX?: number;
  targetY?: number;
};

const DEFAULT_SCENE_ACTOR_METRICS: CompanionActorMetrics = {
  sourceWidth: DEFAULT_GHOSTLING_ACTOR_METRICS.sourceWidth,
  sourceHeight: DEFAULT_GHOSTLING_ACTOR_METRICS.sourceHeight,
  visibleBounds: DEFAULT_GHOSTLING_ACTOR_METRICS.visibleBounds,
  footprintBounds: DEFAULT_GHOSTLING_ACTOR_METRICS.footprintBounds,
  feetAnchor: DEFAULT_GHOSTLING_ACTOR_METRICS.feetAnchor,
};
const DEFAULT_SCENE_TUNING = createDefaultGhostlingSceneTuningSpec();

type GhostlingSceneAdvanceOptions = {
  dtMs: number;
  world: GhostlingWorldSpec;
  profile: GhostlingSceneProfile;
  peers: GhostlingScenePeerState[];
  fadeMs?: number;
  removing?: boolean;
  reducedMotion?: boolean;
  fallback?: boolean;
};

type GhostlingPlacement = {
  point: GhostlingWorldPoint;
  safeZone: GhostlingWorldSafeZone;
  scaleTier: GhostlingWorldScaleTier;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRange(seedKey: string, min: number, max: number) {
  if (max <= min) return min;
  const rng = mulberry32(hashSeed(seedKey));
  return min + (rng() * (max - min));
}

function pointByKey(world: GhostlingWorldSpec, pointKey: string) {
  return world.points.find((point) => point.key === pointKey) ?? null;
}

function safeZoneByKey(world: GhostlingWorldSpec, safeZoneKey: string) {
  return world.safeZones.find((safeZone) => safeZone.key === safeZoneKey) ?? null;
}

function safeZoneForPoint(world: GhostlingWorldSpec, pointKey: string) {
  const point = pointByKey(world, pointKey);
  return point ? safeZoneByKey(world, point.safeZoneKey) : null;
}

function effectiveSceneScale(
  state: Pick<GhostlingSceneMotionState, 'scaleTier' | 'renderScale'>,
) {
  return Math.max(state.scaleTier, state.renderScale);
}

function sceneActorMetrics(
  metrics?: CompanionActorMetrics | null,
) {
  return metrics ?? DEFAULT_SCENE_ACTOR_METRICS;
}

function clampPointToWorld(
  x: number,
  y: number,
  safeZone: GhostlingWorldSafeZone,
  world: GhostlingWorldSpec,
  scale: number,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const visibleExtents = scaledGhostlingVisibleExtents(scale, sceneActorMetrics(actorMetrics));
  const minX = Math.max(safeZone.bounds.x + visibleExtents.left, world.safeArea.x + visibleExtents.left);
  const maxX = Math.min(
    safeZone.bounds.x + safeZone.bounds.width - visibleExtents.right,
    world.safeArea.x + world.safeArea.width - visibleExtents.right,
  );
  const minY = Math.max(safeZone.bounds.y + visibleExtents.top, world.safeArea.y + visibleExtents.top);
  const maxY = Math.min(
    safeZone.bounds.y + safeZone.bounds.height - visibleExtents.bottom,
    world.safeArea.y + world.safeArea.height - visibleExtents.bottom,
  );
  return {
    x: clamp(x, minX, Math.max(minX, maxX)),
    y: clamp(y, minY, Math.max(minY, maxY)),
  };
}

function clampPointToSafeArea(
  x: number,
  y: number,
  world: GhostlingWorldSpec,
  scale: number,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const visibleExtents = scaledGhostlingVisibleExtents(scale, sceneActorMetrics(actorMetrics));
  const minX = world.safeArea.x + visibleExtents.left;
  const maxX = world.safeArea.x + world.safeArea.width - visibleExtents.right;
  const minY = world.safeArea.y + visibleExtents.top;
  const maxY = world.safeArea.y + world.safeArea.height - visibleExtents.bottom;
  return {
    x: clamp(x, minX, Math.max(minX, maxX)),
    y: clamp(y, minY, Math.max(minY, maxY)),
  };
}

function pointInsideZone(
  x: number,
  y: number,
  safeZone: GhostlingWorldSafeZone,
  world: GhostlingWorldSpec,
  scale: number,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const clamped = clampPointToWorld(x, y, safeZone, world, scale, actorMetrics);
  return Math.abs(clamped.x - x) < 0.01 && Math.abs(clamped.y - y) < 0.01;
}

function roamRadii(
  placement: GhostlingPlacement,
  fallback = false,
) {
  if (fallback) {
    return { x: 8, y: 6 };
  }

  const horizontal = Math.max(14, placement.safeZone.roamRadius);
  const vertical = Math.max(8, Math.min(18, Math.round(placement.safeZone.roamRadius * 0.42)));
  return {
    x: horizontal,
    y: vertical,
  };
}

function minimumTargetTravelDistance(
  placement: GhostlingPlacement,
  profile: GhostlingSceneProfile,
  fallback = false,
) {
  if (fallback) {
    return 10;
  }

  return Math.max(
    20,
    Math.min(
      placement.safeZone.roamRadius * 0.72,
      profile.minGap * profile.minTargetTravelRatio,
    ),
  );
}

function scaleForDepthPosition(
  world: GhostlingWorldSpec,
  y: number,
  fallback = false,
) {
  if (fallback) return world.fallbackAnchor.scaleTier;

  const rearPoints = world.points.filter((point) => point.scaleTier === 2);
  const frontPoints = world.points.filter((point) => point.scaleTier === 3);
  if (!rearPoints.length || !frontPoints.length) {
    return 2;
  }

  const rearY = rearPoints.reduce((sum, point) => sum + point.y, 0) / rearPoints.length;
  const frontY = frontPoints.reduce((sum, point) => sum + point.y, 0) / frontPoints.length;
  const span = Math.max(1, frontY - rearY);
  const progress = clamp((y - rearY) / span, 0, 1);
  return 2 + progress;
}

function pauseDurationMs(
  key: string,
  targetSerial: number,
  profile: GhostlingSceneProfile,
  fallback = false,
) {
  return Math.round(seededRange(
    `${key}:pause:${targetSerial}`,
    fallback ? 420 : profile.pauseMinMs,
    fallback ? 860 : profile.pauseMaxMs,
  ));
}

function fallbackZone(world: GhostlingWorldSpec): GhostlingWorldSafeZone {
  const anchor = world.fallbackAnchor;
  return {
    key: anchor.safeZoneKey,
    label: anchor.label,
    layer: 'front',
    bounds: {
      x: anchor.x - 18,
      y: anchor.y - 16,
      width: 36,
      height: 24,
    },
    roamRadius: 8,
  };
}

function fallbackPlacement(world: GhostlingWorldSpec): GhostlingPlacement {
  return {
    point: world.fallbackAnchor,
    safeZone: fallbackZone(world),
    scaleTier: world.fallbackAnchor.scaleTier,
  };
}

function resolvePlacement(
  world: GhostlingWorldSpec,
  profile: GhostlingSceneProfile,
  preferredPointKey?: string,
  pointOrder: string[] = profile.pointOrder,
  isFallback = false,
): GhostlingPlacement {
  if (isFallback) return fallbackPlacement(world);

  const pointKey = preferredPointKey && pointOrder.includes(preferredPointKey)
    ? preferredPointKey
    : pointOrder[0]
      ?? world.fallbackAnchor.key;
  const point = pointByKey(world, pointKey) ?? world.fallbackAnchor;
  const safeZone = safeZoneByKey(world, point.safeZoneKey) ?? fallbackZone(world);
  return {
    point,
    safeZone,
    scaleTier: point.scaleTier,
  };
}

function pointWithinSafeZone(
  seedKey: string,
  world: GhostlingWorldSpec,
  placement: GhostlingPlacement,
  serial: number,
  fallback = false,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const rng = mulberry32(hashSeed(`${seedKey}:${placement.safeZone.key}:${serial}`));
  const radii = roamRadii(placement, fallback);
  const minX = placement.point.x - radii.x;
  const maxX = placement.point.x + radii.x;
  const minY = placement.point.y - radii.y;
  const maxY = placement.point.y + radii.y;
  const rawX = minX >= maxX ? placement.point.x : minX + (rng() * (maxX - minX));
  const rawY = minY >= maxY ? placement.point.y : minY + (rng() * (maxY - minY));
  return clampPointToWorld(rawX, rawY, placement.safeZone, world, placement.scaleTier, actorMetrics);
}

function pointOutsidePlacementRoam(
  x: number,
  y: number,
  placement: GhostlingPlacement,
  fallback = false,
) {
  const radii = roamRadii(placement, fallback);
  return Math.abs(x - placement.point.x) > (radii.x * 1.25)
    || Math.abs(y - placement.point.y) > (radii.y * 1.6);
}

function pointDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  return Math.hypot(toX - fromX, toY - fromY);
}

function resolveSpawnPoint(
  key: string,
  world: GhostlingWorldSpec,
  placement: GhostlingPlacement,
  profile: GhostlingSceneProfile,
  peers: GhostlingScenePeerState[],
  fallback = false,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const state = {
    key,
    x: placement.point.x,
    y: placement.point.y,
  } satisfies Pick<GhostlingSceneMotionState, 'key' | 'x' | 'y'>;

  const candidates: Array<Pick<GhostlingSceneMotionState, 'x' | 'y' | 'scaleTier'>> = [];
  for (let attempt = 0; attempt <= 9; attempt += 1) {
    const candidate = pointWithinSafeZone(
      attempt === 0 ? `${key}:spawn` : `${key}:spawn:${attempt}`,
      world,
      placement,
      attempt,
      fallback,
      actorMetrics,
    );
    candidates.push({
      ...candidate,
      scaleTier: placement.scaleTier,
    });
  }

  let bestCandidate = candidates[0] ?? {
    x: placement.point.x,
    y: placement.point.y,
    scaleTier: placement.scaleTier,
  };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = targetCandidateScore(state, candidate, actorMetrics, peers, profile);
    if (!score.blocked) {
      return {
        x: candidate.x,
        y: candidate.y,
      };
    }

    if (score.nearestMargin > bestScore) {
      bestScore = score.nearestMargin;
      bestCandidate = candidate;
    }
  }

  return {
    x: bestCandidate.x,
    y: bestCandidate.y,
  };
}

function targetExclusionHalfExtents(
  scale: number,
  actorMetrics: CompanionActorMetrics,
  peerScale: number,
  peerActorMetrics: CompanionActorMetrics,
  profile: GhostlingSceneProfile,
) {
  const footprint = scaledGhostlingFootprintForMetrics(scale, sceneActorMetrics(actorMetrics));
  const peerFootprint = scaledGhostlingFootprintForMetrics(peerScale, sceneActorMetrics(peerActorMetrics));

  return {
    x: Math.max(
      profile.minGap * 0.55,
      Math.max(footprint.width, peerFootprint.width),
    ),
    y: Math.max(
      profile.minGap * 0.28,
      Math.max(footprint.height, peerFootprint.height),
    ),
  };
}

function targetCandidateScore(
  state: Pick<GhostlingSceneMotionState, 'key' | 'x' | 'y'>,
  candidate: Pick<GhostlingSceneMotionState, 'x' | 'y' | 'scaleTier'>,
  actorMetrics: CompanionActorMetrics,
  peers: GhostlingScenePeerState[],
  profile: GhostlingSceneProfile,
) {
  const travelDistance = pointDistance(state.x, state.y, candidate.x, candidate.y);
  let blocked = false;
  let nearestMargin = Number.POSITIVE_INFINITY;

  for (const peer of peers) {
    if (peer.key === state.key) continue;
    const occupiedPoints = [
      { x: peer.x, y: peer.y },
      { x: peer.targetX ?? peer.x, y: peer.targetY ?? peer.y },
    ];

      const halfExtents = targetExclusionHalfExtents(
        candidate.scaleTier,
        actorMetrics,
        effectiveSceneScale(peer),
        peer.actorMetrics,
        profile,
      );

    for (const occupied of occupiedPoints) {
      const dx = Math.abs(candidate.x - occupied.x);
      const dy = Math.abs(candidate.y - occupied.y);
      const margin = Math.max(dx - halfExtents.x, dy - halfExtents.y);
      nearestMargin = Math.min(nearestMargin, margin);

      if (dx < halfExtents.x && dy < halfExtents.y) {
        blocked = true;
      }
    }
  }

  if (!Number.isFinite(nearestMargin)) {
    nearestMargin = profile.minGap;
  }

  return {
    blocked,
    nearestMargin,
    travelDistance,
  };
}

function resolveTargetPoint(
  state: Pick<GhostlingSceneMotionState, 'key' | 'x' | 'y'>,
  world: GhostlingWorldSpec,
  placement: GhostlingPlacement,
  serial: number,
  profile: GhostlingSceneProfile,
  peers: GhostlingScenePeerState[],
  fallback = false,
  actorMetrics: CompanionActorMetrics = DEFAULT_SCENE_ACTOR_METRICS,
) {
  const minTravelDistance = minimumTargetTravelDistance(placement, profile, fallback);
  const sampledCandidates: Array<Pick<GhostlingSceneMotionState, 'x' | 'y' | 'scaleTier'>> = [];

  for (let attempt = 0; attempt <= 9; attempt += 1) {
    const candidate = pointWithinSafeZone(
      attempt === 0 ? state.key : `${state.key}:alt:${attempt}`,
      world,
      placement,
      serial + attempt,
      fallback,
      actorMetrics,
    );
    sampledCandidates.push({
      ...candidate,
      scaleTier: placement.scaleTier,
    });
  }

  const zoneCenterX = placement.safeZone.bounds.x + (placement.safeZone.bounds.width / 2);
  const zoneCenterY = placement.safeZone.bounds.y + (placement.safeZone.bounds.height / 2);
  const direction = state.x <= zoneCenterX ? 1 : -1;
  const forcedX = state.x + (direction * Math.min(minTravelDistance, placement.safeZone.roamRadius));
  const forcedY = zoneCenterY + ((state.y <= zoneCenterY ? 1 : -1) * Math.min(minTravelDistance * 0.2, placement.safeZone.roamRadius * 0.2));
  sampledCandidates.push({
    ...clampPointToWorld(forcedX, forcedY, placement.safeZone, world, placement.scaleTier, actorMetrics),
    scaleTier: placement.scaleTier,
  });

  let bestCandidate = sampledCandidates[0] ?? {
    x: placement.point.x,
    y: placement.point.y,
    scaleTier: placement.scaleTier,
  };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of sampledCandidates) {
    const score = targetCandidateScore(state, candidate, actorMetrics, peers, profile);
    if (!score.blocked && score.travelDistance >= minTravelDistance) {
      return {
        x: candidate.x,
        y: candidate.y,
      };
    }

    const weightedScore = score.nearestMargin + Math.min(score.travelDistance, minTravelDistance) * 0.45;
    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestCandidate = candidate;
    }
  }

  return {
    x: bestCandidate.x,
    y: bestCandidate.y,
  };
}

function placementForPoint(
  state: GhostlingSceneMotionState,
  world: GhostlingWorldSpec,
  point: GhostlingWorldPoint,
) {
  const safeZone = safeZoneByKey(world, point.safeZoneKey) ?? fallbackZone(world);
  return {
    point,
    safeZone,
    scaleTier: point.scaleTier,
  } satisfies GhostlingPlacement;
}

function resolveNextPlacement(
  state: GhostlingSceneMotionState,
  world: GhostlingWorldSpec,
  profile: GhostlingSceneProfile,
  crowding: number,
  fallback = false,
) {
  if (fallback) {
    return fallbackPlacement(world);
  }

  const currentPoint = pointByKey(world, state.pointKey) ?? world.fallbackAnchor;
  if (!profile.allowedPointKeys.has(currentPoint.key)) {
    return resolvePlacement(world, profile, undefined, profile.pointOrder, false);
  }
  if (currentPoint.adjacent.length === 0) {
    return placementForPoint(state, world, currentPoint);
  }

  const adjacentPoints = currentPoint.adjacent
    .map((adjacentKey) => pointByKey(world, adjacentKey))
    .filter((point): point is GhostlingWorldPoint => point !== null)
    .filter((point) => profile.allowedPointKeys.has(point.key));

  if (adjacentPoints.length === 0) {
    return placementForPoint(state, world, currentPoint);
  }

  const shouldHop = crowding > 0.06
    || seededRange(`${state.key}:anchor-hop:${state.targetSerial}`, 0, 1) < profile.anchorHopChance;
  if (!shouldHop) {
    return placementForPoint(state, world, currentPoint);
  }

  const selectedIndex = Math.floor(
    seededRange(`${state.key}:adjacent:${state.targetSerial}`, 0, adjacentPoints.length),
  );
  return placementForPoint(
    state,
    world,
    adjacentPoints[Math.min(selectedIndex, adjacentPoints.length - 1)],
  );
}

function separationVector(
  state: GhostlingSceneMotionState,
  peers: GhostlingScenePeerState[],
  minGap: number,
) {
  let x = 0;
  let y = 0;

  for (const peer of peers) {
    if (peer.key === state.key) continue;
    const dx = state.x - peer.x;
    const dy = state.y - peer.y;
    const distance = Math.hypot(dx, dy);
    const stateFootprint = scaledGhostlingFootprintForMetrics(
      effectiveSceneScale(state),
      sceneActorMetrics(state.actorMetrics),
    );
    const peerFootprint = scaledGhostlingFootprintForMetrics(
      effectiveSceneScale(peer),
      sceneActorMetrics(peer.actorMetrics),
    );
    const desiredGap = Math.max(
      minGap,
      (((stateFootprint.width + peerFootprint.width) / 2) * 1.25),
    );
    if (distance <= 0 || distance >= desiredGap) continue;
    const strength = (desiredGap - distance) / desiredGap;
    x += (dx / distance) * strength;
    y += (dy / distance) * strength * 0.7;
  }

  return { x, y };
}

export function resolveGhostlingSceneProfile(
  width: number,
  variant: GhostlingSceneVariant = 'section',
  densityCaps: GhostlingSceneDensityCaps = {},
  tuning: GhostlingSceneTuningSpec = DEFAULT_SCENE_TUNING,
  world: GhostlingWorldSpec = SHARED_COMMONS_WORLD,
) {
  const bucket = resolveGhostlingSceneBucket(width);
  return resolveGhostlingSceneTuning(
    world,
    bucket,
    variant,
    tuning,
    densityCaps[bucket],
  ) satisfies GhostlingSceneProfile;
}

export function preferredGhostlingScenePointKey(
  profile: GhostlingSceneProfile,
  memberIndex: number,
  isFallback = false,
) {
  if (isFallback) return SHARED_COMMONS_WORLD.fallbackAnchor.key;
  return profile.pointOrder[memberIndex % Math.max(1, profile.pointOrder.length)] ?? SHARED_COMMONS_WORLD.fallbackAnchor.key;
}

export function resolveGhostlingSceneDisplaySize(
  scale: number,
  worldScale: number,
) {
  return scaleGhostlingFrameSize(scale) * worldScale;
}

export function createGhostlingSceneMotionState(
  key: string,
  world: GhostlingWorldSpec,
  profile: GhostlingSceneProfile,
  preferredPointKey?: string,
  options: { fallback?: boolean; peers?: GhostlingScenePeerState[]; actorMetrics?: CompanionActorMetrics } = {},
) {
  const actorMetrics = sceneActorMetrics(options.actorMetrics);
  const placement = resolvePlacement(
    world,
    profile,
    preferredPointKey,
    profile.pointOrder,
    Boolean(options.fallback),
  );
  const spawn = resolveSpawnPoint(
    key,
    world,
    placement,
    profile,
    options.peers ?? [],
    Boolean(options.fallback),
    actorMetrics,
  );
  const target = resolveTargetPoint(
    { key, x: spawn.x, y: spawn.y },
    world,
    placement,
    1,
    profile,
    options.peers ?? [],
    Boolean(options.fallback),
    actorMetrics,
  );

  return {
    key,
    x: spawn.x,
    y: spawn.y,
    targetX: target.x,
    targetY: target.y,
    speed: seededRange(`${key}:speed:0`, profile.speedMin, profile.speedMax),
    velocityX: 0,
    velocityY: 0,
    pauseRemainingMs: 0,
    phaseRemainingMs: 0,
    targetSerial: 0,
    safeZoneKey: placement.safeZone.key,
    pointKey: placement.point.key,
    scaleTier: placement.scaleTier,
    renderScale: placement.scaleTier,
    movementPhase: 'travel',
    facingLeft: seededRange(`${key}:flip`, 0, 1) < 0.5,
    opacity: 0,
    jammedMs: 0,
    actorMetrics,
  } satisfies GhostlingSceneMotionState;
}

export function rehomeGhostlingSceneEntity(
  state: GhostlingSceneMotionState,
  world: GhostlingWorldSpec,
  profile: GhostlingSceneProfile,
  preferredPointKey?: string,
  options: { fallback?: boolean; peers?: GhostlingScenePeerState[] } = {},
) {
  const placement = resolvePlacement(
    world,
    profile,
    preferredPointKey,
    profile.pointOrder,
    Boolean(options.fallback),
  );
  const nextSerial = state.targetSerial + 1;
  const target = resolveTargetPoint(
    state,
    world,
    placement,
    nextSerial,
    profile,
    options.peers ?? [],
    Boolean(options.fallback),
    state.actorMetrics,
  );
  const clamped = clampPointToWorld(state.x, state.y, placement.safeZone, world, placement.scaleTier, state.actorMetrics);

  return {
    ...state,
    x: clamped.x,
    y: clamped.y,
    targetX: target.x,
    targetY: target.y,
    targetSerial: nextSerial,
    phaseRemainingMs: 0,
    safeZoneKey: placement.safeZone.key,
    pointKey: placement.point.key,
    scaleTier: placement.scaleTier,
    renderScale: placement.scaleTier,
    movementPhase: 'travel',
    pauseRemainingMs: 0,
    jammedMs: 0,
    actorMetrics: state.actorMetrics,
  } satisfies GhostlingSceneMotionState;
}

export function advanceGhostlingSceneEntity(
  state: GhostlingSceneMotionState,
  options: GhostlingSceneAdvanceOptions,
) {
  const fadeMs = options.fadeMs ?? 900;
  const next = {
    ...state,
    jammedMs: Math.max(0, state.jammedMs ?? 0),
  };

  if (options.removing) {
    next.velocityX = 0;
    next.velocityY = 0;
    next.opacity = clamp(state.opacity - (options.dtMs / fadeMs), 0, 1);
    return next;
  }

  next.opacity = clamp(state.opacity + (options.dtMs / fadeMs), 0, 1);

  const fallback = Boolean(options.fallback);
  if (options.reducedMotion) {
    const placement = resolvePlacement(
      options.world,
      options.profile,
      next.pointKey,
      options.profile.pointOrder,
      fallback,
    );
    next.x = placement.point.x;
    next.y = placement.point.y;
    next.targetX = placement.point.x;
    next.targetY = placement.point.y;
    next.safeZoneKey = placement.safeZone.key;
    next.pointKey = placement.point.key;
    next.scaleTier = placement.scaleTier;
    next.renderScale = placement.scaleTier;
    next.velocityX = 0;
    next.velocityY = 0;
    next.pauseRemainingMs = 0;
    next.phaseRemainingMs = 0;
    next.movementPhase = 'paused';
    next.jammedMs = 0;
    next.actorMetrics = state.actorMetrics;
    return next;
  }

  const dtSeconds = Math.max(0.001, options.dtMs / 1000);
  const settleFactor = Math.min(1, dtSeconds * options.profile.settleDamping);
  const currentPoint = fallback
    ? options.world.fallbackAnchor
    : pointByKey(options.world, next.pointKey) ?? options.world.fallbackAnchor;
  const currentPlacement = fallback
    ? fallbackPlacement(options.world)
    : placementForPoint(next, options.world, currentPoint);

  if (
    !fallback
    && next.movementPhase === 'travel'
    && pointOutsidePlacementRoam(next.targetX, next.targetY, currentPlacement, false)
  ) {
    next.targetSerial += 1;
    const target = resolveTargetPoint(
        next,
        options.world,
        currentPlacement,
        next.targetSerial,
        options.profile,
        options.peers,
        false,
        next.actorMetrics,
      );
      next.targetX = target.x;
      next.targetY = target.y;
      next.pauseRemainingMs = Math.min(next.pauseRemainingMs, 120);
      next.phaseRemainingMs = 0;
      next.movementPhase = 'travel';
      next.jammedMs = 0;
      next.speed = seededRange(
        `${next.key}:speed:${next.targetSerial}`,
        options.profile.speedMin,
      options.profile.speedMax,
    );
  }

  if (next.pauseRemainingMs > 0 || next.movementPhase === 'paused') {
    next.movementPhase = 'paused';
    next.pauseRemainingMs = Math.max(0, next.pauseRemainingMs - options.dtMs);
    next.phaseRemainingMs = next.pauseRemainingMs;
    next.velocityX += (0 - next.velocityX) * settleFactor;
    next.velocityY += (0 - next.velocityY) * settleFactor;
    const pausedSeparation = separationVector(next, options.peers, options.profile.minGap);
    const pausedCrowding = Math.hypot(pausedSeparation.x, pausedSeparation.y);
    if (pausedCrowding > 0.001) {
      const pauseSafeZone = fallback
        ? fallbackZone(options.world)
        : safeZoneByKey(options.world, next.safeZoneKey) ?? safeZoneForPoint(options.world, next.pointKey) ?? fallbackZone(options.world);
      const nudged = clampPointToWorld(
        next.x + (pausedSeparation.x * next.speed * dtSeconds * 0.18),
        next.y + (pausedSeparation.y * next.speed * dtSeconds * 0.1),
        pauseSafeZone,
        options.world,
        effectiveSceneScale(next),
        next.actorMetrics,
      );
      next.x = nudged.x;
      next.y = nudged.y;
    }
    if (next.pauseRemainingMs === 0) {
      next.targetSerial += 1;
      const placement = resolveNextPlacement(next, options.world, options.profile, pausedCrowding, fallback);
      const target = resolveTargetPoint(
        next,
        options.world,
        placement,
        next.targetSerial,
        options.profile,
        options.peers,
        fallback,
        next.actorMetrics,
      );
      next.safeZoneKey = placement.safeZone.key;
      next.pointKey = placement.point.key;
      next.scaleTier = placement.scaleTier;
      next.targetX = target.x;
      next.targetY = target.y;
      next.phaseRemainingMs = 0;
      next.movementPhase = 'travel';
      next.jammedMs = 0;
      next.speed = seededRange(
        `${next.key}:speed:${next.targetSerial}`,
        options.profile.speedMin,
        options.profile.speedMax,
      );
    }
    if (next.pauseRemainingMs > 0) {
      next.renderScale = scaleForDepthPosition(options.world, next.y, fallback);
      return next;
    }
  }

  const dx = next.targetX - next.x;
  const dy = next.targetY - next.y;
  const distance = Math.hypot(dx, dy);
  const desiredX = distance > 0 ? dx / distance : 0;
  const desiredY = distance > 0 ? dy / distance : 0;
  const separation = separationVector(next, options.peers, options.profile.minGap);
  const safeZone = fallback
    ? fallbackZone(options.world)
    : safeZoneByKey(options.world, next.safeZoneKey) ?? safeZoneForPoint(options.world, next.pointKey) ?? fallbackZone(options.world);
  const applyMotionClamp = () => {
    const activeScale = Math.max(1, next.renderScale);
    const unclampedX = next.x + (next.velocityX * dtSeconds);
    const unclampedY = next.y + (next.velocityY * dtSeconds);
    const useZoneClamp = pointInsideZone(next.x, next.y, safeZone, options.world, activeScale, next.actorMetrics);
    const clamped = useZoneClamp ? clampPointToWorld(
      unclampedX,
      unclampedY,
      safeZone,
      options.world,
      activeScale,
      next.actorMetrics,
    ) : clampPointToSafeArea(
      unclampedX,
      unclampedY,
      options.world,
      activeScale,
      next.actorMetrics,
    );
    next.x = clamped.x;
    next.y = clamped.y;
    next.renderScale = scaleForDepthPosition(options.world, next.y, fallback);
  };

  if (next.movementPhase === 'settle' || distance <= options.profile.arrivalRadius * 0.92) {
    next.movementPhase = 'settle';
    next.phaseRemainingMs = next.phaseRemainingMs > 0
      ? Math.max(0, next.phaseRemainingMs - options.dtMs)
      : Math.max(160, Math.round(options.profile.arrivalRadius * 18));
    const settleSpeed = Math.min(
      Math.max(4.5, distance * 4.2),
      Math.max(6, next.speed * 0.48),
    );
    const settleVelocityX = (desiredX * settleSpeed) + (separation.x * next.speed * 0.12);
    const settleVelocityY = (desiredY * settleSpeed * Math.min(options.profile.verticalTravelFactor, 0.6))
      + (separation.y * next.speed * 0.08);
    const settleBlend = Math.min(1, dtSeconds * 8.5);

    next.velocityX += (settleVelocityX - next.velocityX) * settleBlend;
    next.velocityY += (settleVelocityY - next.velocityY) * settleBlend;
    applyMotionClamp();

    const remainingDistance = Math.hypot(next.targetX - next.x, next.targetY - next.y);
    const currentSpeed = Math.hypot(next.velocityX, next.velocityY);
    next.jammedMs = Math.max(0, next.jammedMs - (options.dtMs * 1.5));

    if (
      remainingDistance <= options.profile.settleRadius
      && currentSpeed <= Math.max(1.4, next.speed * 0.16)
    ) {
      next.x = next.targetX;
      next.y = next.targetY;
      next.renderScale = scaleForDepthPosition(options.world, next.y, fallback);
      next.velocityX = 0;
      next.velocityY = 0;
      next.pauseRemainingMs = pauseDurationMs(next.key, next.targetSerial, options.profile, fallback);
      next.phaseRemainingMs = next.pauseRemainingMs;
      next.movementPhase = 'paused';
      return next;
    }

    if (next.phaseRemainingMs === 0) {
      next.pauseRemainingMs = pauseDurationMs(next.key, next.targetSerial, options.profile, fallback);
      next.phaseRemainingMs = next.pauseRemainingMs;
      next.movementPhase = 'paused';
      return next;
    }

    return next;
  }

  next.movementPhase = 'travel';
  next.phaseRemainingMs = 0;
  const arrivalFactor = distance <= options.profile.arrivalRadius
    ? Math.max(0.42, distance / options.profile.arrivalRadius)
    : 1;
  const desiredSpeed = next.speed * arrivalFactor;
  const targetVelocityX = (desiredX * desiredSpeed) + (separation.x * next.speed * 0.66);
  const targetVelocityY = (desiredY * desiredSpeed * options.profile.verticalTravelFactor)
    + (separation.y * next.speed * 0.4);

  next.velocityX += (targetVelocityX - next.velocityX) * settleFactor;
  next.velocityY += (targetVelocityY - next.velocityY) * settleFactor;
  applyMotionClamp();

  const remainingDistance = Math.hypot(next.targetX - next.x, next.targetY - next.y);
  const horizontalIntent = next.targetX - next.x;
  const facingVelocityThreshold = Math.max(options.profile.facingFlipVelocity * 1.25, next.speed * 0.18);
  const facingDistanceThreshold = Math.max(
    options.profile.facingFlipDistance,
    options.profile.minGap * 0.72,
  );
  const facingIntentThreshold = Math.max(
    48,
    scaleGhostlingFrameSize(Math.max(1, next.renderScale)) * 0.55,
    facingDistanceThreshold,
  );
  const horizontalProgress = Math.abs(horizontalIntent) / Math.max(1, remainingDistance);
  if (
    remainingDistance > facingDistanceThreshold
    && Math.abs(next.velocityX) >= facingVelocityThreshold
    && Math.abs(horizontalIntent) >= facingIntentThreshold
    && horizontalProgress >= 0.9
    && Math.sign(horizontalIntent) === Math.sign(next.velocityX)
  ) {
    next.facingLeft = horizontalIntent < 0;
  }

  const currentSpeed = Math.hypot(next.velocityX, next.velocityY);
  const crowding = Math.hypot(separation.x, separation.y);
  const targetScore = targetCandidateScore(
    next,
    { x: next.targetX, y: next.targetY, scaleTier: next.scaleTier },
    next.actorMetrics,
    options.peers,
    options.profile,
  );
  const targetBlocked = targetScore.blocked;
  const jamWindowDistance = Math.max(
    options.profile.arrivalRadius,
    minimumTargetTravelDistance(currentPlacement, options.profile, fallback) * 1.05,
  );
  const jammed = targetBlocked
    && crowding >= 0.18
    && remainingDistance >= Math.max(options.profile.arrivalRadius * 0.95, 12)
    && remainingDistance <= jamWindowDistance
    && currentSpeed <= Math.max(options.profile.speedMin * 0.16, next.speed * 0.24);
  next.jammedMs = jammed
    ? next.jammedMs + options.dtMs
    : Math.max(0, next.jammedMs - (options.dtMs * 1.5));

  if (!fallback && next.jammedMs >= options.profile.jamBreakoutMs) {
    next.targetSerial += 1;
    const placement = resolveNextPlacement(next, options.world, options.profile, Math.max(0.16, crowding), false);
    const target = resolveTargetPoint(
      next,
      options.world,
      placement,
      next.targetSerial,
      options.profile,
      options.peers,
      false,
      next.actorMetrics,
    );
    next.pointKey = placement.point.key;
    next.safeZoneKey = placement.safeZone.key;
    next.scaleTier = placement.scaleTier;
    next.targetX = target.x;
    next.targetY = target.y;
    next.pauseRemainingMs = 0;
    next.phaseRemainingMs = 0;
    next.movementPhase = 'travel';
    next.jammedMs = 0;
    next.speed = seededRange(
      `${next.key}:speed:${next.targetSerial}`,
      options.profile.speedMin,
      options.profile.speedMax,
    );
    return next;
  }

  if (remainingDistance <= options.profile.settleRadius && currentSpeed <= next.speed * 0.28) {
    next.x = next.targetX;
    next.y = next.targetY;
    next.renderScale = scaleForDepthPosition(options.world, next.y, fallback);
    next.velocityX = 0;
    next.velocityY = 0;
    next.jammedMs = 0;
    next.pauseRemainingMs = pauseDurationMs(next.key, next.targetSerial, options.profile, fallback);
    next.phaseRemainingMs = next.pauseRemainingMs;
    next.movementPhase = 'paused';
  }

  return next;
}
