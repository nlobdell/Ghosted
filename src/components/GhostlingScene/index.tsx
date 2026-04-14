'use client';

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatedCompanionStage } from '@/components/companion/AnimatedCompanionStage';
import type { StagePresentation } from '@/lib/companion-motion';
import {
  DEFAULT_GHOSTLING_ACTOR_METRICS,
  resolveGhostlingActorMetricsFromCompanion,
  scaledGhostlingVisibleBounds,
  scaledGhostlingVisibleExtents,
} from '@/lib/ghostling-actor';
import { buildHomePageSceneFixture } from '@/lib/homepage-scene-fixtures';
import {
  createGhostlingSceneCameraMetrics,
  projectGhostlingWorldPoint,
  resolveGhostlingLabelClampOffset,
  type GhostlingSceneCameraMetrics,
} from '@/lib/ghostling-camera';
import {
  advanceGhostlingSceneEntity,
  createGhostlingSceneMotionState,
  preferredGhostlingScenePointKey,
  rehomeGhostlingSceneEntity,
  resolveGhostlingSceneDisplaySize,
  resolveGhostlingSceneProfile,
  type GhostlingSceneDensityCaps,
  type GhostlingSceneFallbackMode,
  type GhostlingSceneMotionState,
  type GhostlingSceneVariant,
} from '@/lib/ghostling-scene';
import {
  cloneGhostlingSceneTuningSpec,
  createDefaultGhostlingSceneTuningSpec,
  type GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';
import { resolveSceneRealtimeClientUrl } from '@/lib/scene-realtime';
import {
  SHARED_COMMONS_WORLD,
  ghostlingWorldById,
  resolveGhostlingHeroCrop,
  resolveGhostlingSceneBucket,
  type GhostlingSceneDensityBucket,
  type GhostlingWorldId,
  type GhostlingWorldPreset,
  type GhostlingWorldSpec,
} from '@/lib/ghostling-world';
import {
  cloneGhostlingSceneLabSnapshot,
  cloneGhostlingWorldDraft,
  ghostlingSceneLabSnapshotEquals,
  type GhostlingSceneLabPreviewMode,
  type GhostlingSceneLabSearchQuery,
  type GhostlingSceneLabSelection,
  type GhostlingSceneLabSnapshot,
  type GhostlingSceneLabTab,
} from '@/lib/ghostling-scene-lab';
import type {
  CompanionPreviewSummary,
  ScenePresenceActivity,
  ScenePresenceMember,
  ScenePresencePayload,
  ScenePresenceSocketMessage,
  SceneSharedEntityState,
} from '@/lib/types';
import styles from './GhostlingScene.module.css';
import { GhostlingSceneLab, type GhostlingSceneLabMemberDiagnostic } from './GhostlingSceneLab';

type GhostlingSceneProps = {
  variant?: GhostlingSceneVariant;
  overlay?: ReactNode;
  fallbackMode?: GhostlingSceneFallbackMode;
  densityCaps?: GhostlingSceneDensityCaps;
  initialPayload?: ScenePresencePayload | null;
  fallbackCompanion?: CompanionPreviewSummary | null;
  world?: GhostlingWorldId;
  preset?: GhostlingWorldPreset;
  worldSpec?: GhostlingWorldSpec | null;
  tuningSpec?: GhostlingSceneTuningSpec | null;
  heroBucketOverride?: GhostlingSceneDensityBucket | null;
  debugWorldOverlay?: boolean;
  sceneEditorEnabled?: boolean;
  sceneEditorSandboxPayload?: ScenePresencePayload | null;
  realtimeDisabled?: boolean;
};

type SceneEntityState =
  | 'entering'
  | 'idle'
  | 'hovered'
  | 'live-active'
  | 'featured-mascot'
  | 'exiting';

type GhostlingEntity = GhostlingSceneMotionState & {
  username: string;
  displayName: string;
  imgSrc: string;
  companion?: CompanionPreviewSummary;
  source: ScenePresenceMember['source'];
  activity: ScenePresenceActivity;
  removing: boolean;
  fallback: boolean;
  activeUntilTs: number;
  lastSeenSignature: string;
  companionSignature: string;
  displayX: number;
  displayY: number;
  displayRenderScale: number;
  displayFacingLeft: boolean;
  displayOpacity: number;
  heroSamples: GhostlingHeroSample[];
};

type GhostlingHeroSample = Pick<
  SceneSharedEntityState,
  | 'x'
  | 'y'
  | 'targetX'
  | 'targetY'
  | 'velocityX'
  | 'velocityY'
  | 'renderScale'
  | 'scaleTier'
  | 'facingLeft'
  | 'opacity'
  | 'safeZoneKey'
  | 'pointKey'
  | 'movementPhase'
  | 'phaseRemainingMs'
  | 'pauseRemainingMs'
> & {
  sampleAt: number;
};

type RenderGhostlingEntity = Pick<
  GhostlingEntity,
  | 'key'
  | 'username'
  | 'displayName'
  | 'imgSrc'
  | 'companion'
  | 'source'
  | 'fallback'
  | 'activeUntilTs'
  | 'removing'
  | 'x'
  | 'y'
  | 'targetX'
  | 'targetY'
  | 'opacity'
  | 'facingLeft'
  | 'safeZoneKey'
  | 'pointKey'
  | 'scaleTier'
  | 'renderScale'
  | 'speed'
  | 'velocityX'
  | 'velocityY'
  | 'movementPhase'
  | 'actorMetrics'
  | 'companionSignature'
>;

type SharedSceneCorrectionMode = 'snap' | 'smooth' | 'intent';
type SceneLabDraftUpdate<T> = T | ((current: T) => T);
type SceneLabHistoryMode = 'none' | 'immediate';
type HeroPanDragState = {
  pointerId: number;
  startClientX: number;
  startPanXWorld: number;
  thresholdExceeded: boolean;
};

const POLL_MS = 15_000;
const LIVE_ACTIVE_MS = 3_200;
const SOCKET_RECONNECT_BASE_MS = 1_000;
const SOCKET_RECONNECT_MAX_MS = 15_000;
const SCENE_LAB_HISTORY_LIMIT = 100;
const HERO_INTERPOLATION_DELAY_MS = 300;
const HERO_SAMPLE_MAX_AGE_MS = 4_000;
const HERO_MAX_SAMPLE_COUNT = 12;
const HERO_HARD_SNAP_DISTANCE = 420;
const HERO_HARD_SNAP_SCALE_DELTA = 1.1;
const HERO_FACING_VELOCITY_THRESHOLD = 1.5;
const SOFT_SYNC_POSITION_FACTOR = 0.18;
const SOFT_SYNC_TARGET_FACTOR = 0.34;
const SOFT_SYNC_VELOCITY_FACTOR = 0.2;
const SOFT_SYNC_RENDER_SCALE_FACTOR = 0.26;
const SOFT_SYNC_OPACITY_FACTOR = 0.4;
const HERO_PAN_DRAG_THRESHOLD_PX = 8;
const HERO_PAN_WHEEL_LINE_PX = 18;
const HERO_PAN_SMOOTHING_MS = 120;
const HERO_PAN_SETTLE_EPSILON = 0.18;
const HERO_RECENTER_VISIBILITY_THRESHOLD = 1.5;
const DEFAULT_SRC = '/api/companion/render-animated';
const FALLBACK_NAMES = ['Ghosted House', 'Hall Lantern', 'Night Watch'];

function cameraLayoutForVariant(variant: GhostlingSceneVariant) {
  return variant === 'hero' ? 'fixed-crop' : 'responsive-fit';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveDraftUpdate<T>(
  update: SceneLabDraftUpdate<T>,
  current: T,
) {
  return typeof update === 'function'
    ? (update as (draft: T) => T)(current)
    : update;
}

function blend(current: number, next: number, factor: number) {
  return current + ((next - current) * factor);
}

function normalizeHeroWheelDelta(
  delta: number,
  deltaMode: number,
  pageWidthPx: number,
) {
  if (deltaMode === 1) {
    return delta * HERO_PAN_WHEEL_LINE_PX;
  }
  if (deltaMode === 2) {
    return delta * pageWidthPx;
  }
  return delta;
}

function heroLayerParallaxFactor(layerKey: string) {
  switch (layerKey) {
    case 'sky':
      return 0.42;
    case 'midground':
    case 'foreground':
    case 'floor':
    default:
      return 1;
  }
}

function detectHeroMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches;
}

function resolveHeroBucketPreference(
  viewportWidth: number,
  override: GhostlingSceneDensityBucket | null = null,
): GhostlingSceneDensityBucket {
  if (override) return override;
  if (typeof window === 'undefined') return resolveGhostlingSceneBucket(viewportWidth);

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  if (!coarsePointer && !noHover) {
    return 'desktop';
  }

  return resolveGhostlingSceneBucket(viewportWidth);
}

function isSharedHeroVariant(
  variant: GhostlingSceneVariant,
  world: GhostlingWorldId,
  preset: GhostlingWorldPreset,
) {
  return variant === 'hero' && world === 'shared-commons' && preset === 'public-hero';
}

function shouldSnapHeroPresentation(
  current: GhostlingEntity,
  sample: GhostlingHeroSample,
  forceSmooth = false,
) {
  if (forceSmooth) return false;
  if (current.heroSamples.length === 0) return true;
  if (current.fallback !== (sample.pointKey === SHARED_COMMONS_WORLD.fallbackAnchor.key)) return true;
  const distance = Math.hypot(sample.x - current.displayX, sample.y - current.displayY);
  return distance > HERO_HARD_SNAP_DISTANCE
    || Math.abs(sample.renderScale - current.displayRenderScale) > HERO_HARD_SNAP_SCALE_DELTA;
}

function syncEntityAuthoritativeState(
  entity: GhostlingEntity,
  sample: GhostlingHeroSample,
) {
  entity.x = sample.x;
  entity.y = sample.y;
  entity.targetX = sample.targetX;
  entity.targetY = sample.targetY;
  entity.velocityX = sample.velocityX;
  entity.velocityY = sample.velocityY;
  entity.renderScale = sample.renderScale;
  entity.scaleTier = sample.scaleTier;
  entity.safeZoneKey = sample.safeZoneKey;
  entity.pointKey = sample.pointKey;
  entity.facingLeft = sample.facingLeft;
  entity.opacity = sample.opacity;
  entity.movementPhase = sample.movementPhase;
  entity.phaseRemainingMs = sample.phaseRemainingMs;
  entity.pauseRemainingMs = sample.pauseRemainingMs;
}

function heroSampleFromSceneEntity(
  entity: Pick<
    SceneSharedEntityState,
    | 'x'
    | 'y'
    | 'targetX'
    | 'targetY'
    | 'velocityX'
    | 'velocityY'
    | 'renderScale'
    | 'scaleTier'
    | 'facingLeft'
    | 'opacity'
    | 'safeZoneKey'
    | 'pointKey'
    | 'movementPhase'
    | 'phaseRemainingMs'
    | 'pauseRemainingMs'
  >,
  sampleAt: number,
): GhostlingHeroSample {
  return {
    x: entity.x,
    y: entity.y,
    targetX: entity.targetX,
    targetY: entity.targetY,
    velocityX: entity.velocityX,
    velocityY: entity.velocityY,
    renderScale: entity.renderScale,
    scaleTier: entity.scaleTier,
    facingLeft: entity.facingLeft,
    opacity: entity.opacity,
    safeZoneKey: entity.safeZoneKey,
    pointKey: entity.pointKey,
    movementPhase: entity.movementPhase,
    phaseRemainingMs: entity.phaseRemainingMs,
    pauseRemainingMs: entity.pauseRemainingMs,
    sampleAt,
  };
}

function latestHeroSample(samples: GhostlingHeroSample[]) {
  return samples.at(-1) ?? null;
}

function sampleHeroPresentation(
  samples: GhostlingHeroSample[],
  renderAt: number,
) {
  const latest = latestHeroSample(samples);
  if (!latest) return null;
  if (samples.length === 1) {
    return latest;
  }
  if (renderAt <= samples[0]!.sampleAt) {
    return samples[0]!;
  }

  let previous = samples[0]!;
  let next = latest;
  for (let index = 1; index < samples.length; index += 1) {
    const candidate = samples[index]!;
    if (candidate.sampleAt >= renderAt) {
      next = candidate;
      previous = samples[index - 1] ?? candidate;
      break;
    }
    previous = candidate;
  }

  if (next.sampleAt <= previous.sampleAt || renderAt >= latest.sampleAt) {
    return latest;
  }

  const factor = clamp(
    (renderAt - previous.sampleAt) / Math.max(1, next.sampleAt - previous.sampleAt),
    0,
    1,
  );

  return {
    ...next,
    x: blend(previous.x, next.x, factor),
    y: blend(previous.y, next.y, factor),
    targetX: blend(previous.targetX, next.targetX, factor),
    targetY: blend(previous.targetY, next.targetY, factor),
    velocityX: blend(previous.velocityX, next.velocityX, factor),
    velocityY: blend(previous.velocityY, next.velocityY, factor),
    renderScale: blend(previous.renderScale, next.renderScale, factor),
    opacity: blend(previous.opacity, next.opacity, factor),
    phaseRemainingMs: blend(previous.phaseRemainingMs, next.phaseRemainingMs, factor),
    pauseRemainingMs: blend(previous.pauseRemainingMs, next.pauseRemainingMs, factor),
    facingLeft: factor < 0.5 ? previous.facingLeft : next.facingLeft,
    movementPhase: factor < 0.5 ? previous.movementPhase : next.movementPhase,
    sampleAt: renderAt,
  } satisfies GhostlingHeroSample;
}

function pushHeroSample(
  entity: GhostlingEntity,
  sample: GhostlingHeroSample,
  options: { forceSmooth?: boolean } = {},
) {
  const last = latestHeroSample(entity.heroSamples);
  if (last && sample.sampleAt < last.sampleAt) {
    return;
  }

  syncEntityAuthoritativeState(entity, sample);

  if (!last || sample.sampleAt > last.sampleAt) {
    entity.heroSamples = [
      ...entity.heroSamples.filter((entry) => (sample.sampleAt - entry.sampleAt) <= HERO_SAMPLE_MAX_AGE_MS),
      sample,
    ].slice(-HERO_MAX_SAMPLE_COUNT);
  } else {
    entity.heroSamples = [
      ...entity.heroSamples.slice(0, -1),
      sample,
    ].slice(-HERO_MAX_SAMPLE_COUNT);
  }

  if (shouldSnapHeroPresentation(entity, sample, options.forceSmooth)) {
    entity.displayX = sample.x;
    entity.displayY = sample.y;
    entity.displayRenderScale = sample.renderScale;
    entity.displayFacingLeft = sample.facingLeft;
    entity.displayOpacity = sample.opacity;
  }
}

function currentHeroSceneSample(
  entity: Pick<
    GhostlingEntity,
    | 'x'
    | 'y'
    | 'targetX'
    | 'targetY'
    | 'velocityX'
    | 'velocityY'
    | 'renderScale'
    | 'scaleTier'
    | 'facingLeft'
    | 'opacity'
    | 'safeZoneKey'
    | 'pointKey'
    | 'movementPhase'
    | 'phaseRemainingMs'
    | 'pauseRemainingMs'
  >,
  sampleAt: number,
): GhostlingHeroSample {
  return {
    x: entity.x,
    y: entity.y,
    targetX: entity.targetX,
    targetY: entity.targetY,
    velocityX: entity.velocityX,
    velocityY: entity.velocityY,
    renderScale: entity.renderScale,
    scaleTier: entity.scaleTier,
    facingLeft: entity.facingLeft,
    opacity: entity.opacity,
    safeZoneKey: entity.safeZoneKey,
    pointKey: entity.pointKey,
    movementPhase: entity.movementPhase,
    phaseRemainingMs: entity.phaseRemainingMs,
    pauseRemainingMs: entity.pauseRemainingMs,
    sampleAt,
  };
}

function sameStringArray(current: string[], next: string[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) return false;
  }
  return true;
}

function sameRenderMetrics(
  current: GhostlingSceneCameraMetrics,
  next: GhostlingSceneCameraMetrics,
) {
  return current.width === next.width
    && current.height === next.height
    && current.scale === next.scale
    && current.scaleX === next.scaleX
    && current.scaleY === next.scaleY
    && current.renderWidth === next.renderWidth
    && current.renderHeight === next.renderHeight
    && current.offsetX === next.offsetX
    && current.offsetY === next.offsetY
    && current.bucket === next.bucket
    && current.guideMode === next.guideMode
    && current.worldViewport.x === next.worldViewport.x
    && current.worldViewport.y === next.worldViewport.y
    && current.worldViewport.width === next.worldViewport.width
    && current.worldViewport.height === next.worldViewport.height
    && current.labelSafeTopPx === next.labelSafeTopPx;
}

function sameRenderMembers(
  current: RenderGhostlingEntity[],
  next: RenderGhostlingEntity[],
  includeMotion = false,
) {
  if (current === next) return true;
  if (current.length !== next.length) return false;

  for (let index = 0; index < current.length; index += 1) {
    const currentMember = current[index];
    const nextMember = next[index];

    if (
      currentMember.key !== nextMember.key
      || currentMember.username !== nextMember.username
      || currentMember.displayName !== nextMember.displayName
      || currentMember.imgSrc !== nextMember.imgSrc
      || currentMember.source !== nextMember.source
      || currentMember.fallback !== nextMember.fallback
      || currentMember.activeUntilTs !== nextMember.activeUntilTs
      || currentMember.removing !== nextMember.removing
      || currentMember.companionSignature !== nextMember.companionSignature
    ) {
      return false;
    }

    if (!includeMotion) continue;

    if (
      currentMember.x !== nextMember.x
      || currentMember.y !== nextMember.y
      || currentMember.targetX !== nextMember.targetX
      || currentMember.targetY !== nextMember.targetY
      || currentMember.opacity !== nextMember.opacity
      || currentMember.facingLeft !== nextMember.facingLeft
      || currentMember.safeZoneKey !== nextMember.safeZoneKey
      || currentMember.pointKey !== nextMember.pointKey
      || currentMember.scaleTier !== nextMember.scaleTier
      || currentMember.renderScale !== nextMember.renderScale
      || currentMember.speed !== nextMember.speed
      || currentMember.velocityX !== nextMember.velocityX
      || currentMember.velocityY !== nextMember.velocityY
      || currentMember.movementPhase !== nextMember.movementPhase
    ) {
      return false;
    }
  }

  return true;
}

function restoreSharedSceneEntity(
  entity: SceneSharedEntityState,
  sourceWidth: number,
  sourceHeight: number,
  world: GhostlingWorldSpec,
) {
  const scaleX = world.sourceWidth / Math.max(1, sourceWidth);
  const scaleY = world.sourceHeight / Math.max(1, sourceHeight);
  const speedScale = (scaleX + scaleY) / 2;

  return {
    ...entity,
    x: clamp(entity.x * scaleX, 0, world.sourceWidth),
    y: clamp(entity.y * scaleY, 0, world.sourceHeight),
    targetX: clamp(entity.targetX * scaleX, 0, world.sourceWidth),
    targetY: clamp(entity.targetY * scaleY, 0, world.sourceHeight),
    speed: entity.speed * speedScale,
    velocityX: entity.velocityX * scaleX,
    velocityY: entity.velocityY * scaleY,
    phaseRemainingMs: Math.max(0, entity.phaseRemainingMs ?? entity.pauseRemainingMs),
    pauseRemainingMs: Math.max(0, entity.pauseRemainingMs),
    jammedMs: Math.max(0, entity.jammedMs ?? 0),
    renderScale: Math.max(1, entity.renderScale ?? entity.scaleTier),
    actorMetrics: entity.actorMetrics,
  } satisfies SceneSharedEntityState;
}

function applySharedSceneEntity(
  target: GhostlingEntity,
  restored: SceneSharedEntityState,
  sourceWidth: number,
  sourceHeight: number,
  world: GhostlingWorldSpec,
  options: {
    mode?: SharedSceneCorrectionMode;
  } = {},
) {
  const nextState = restoreSharedSceneEntity(restored, sourceWidth, sourceHeight, world);
  const mode = options.mode ?? 'snap';

  if (mode === 'snap') {
    Object.assign(target, nextState);
    return;
  }

  const positionDrift = Math.hypot(nextState.x - target.x, nextState.y - target.y);
  const targetChanged = nextState.targetSerial !== target.targetSerial
    || nextState.pointKey !== target.pointKey
    || nextState.safeZoneKey !== target.safeZoneKey;
  const mustSnap = positionDrift > 180
    || Math.abs(nextState.renderScale - target.renderScale) > 0.75
    || nextState.scaleTier !== target.scaleTier
    || nextState.fallback !== target.fallback;

  if (mustSnap) {
    Object.assign(target, nextState);
    return;
  }

  target.safeZoneKey = nextState.safeZoneKey;
  target.pointKey = nextState.pointKey;
  target.scaleTier = nextState.scaleTier;
  target.targetSerial = nextState.targetSerial;
  target.fallback = nextState.fallback;
  target.source = nextState.source;
  target.activeUntilTs = nextState.activeUntilTs;
  target.lastSeenSignature = nextState.lastSeenSignature;
  target.movementPhase = nextState.movementPhase;
  target.phaseRemainingMs = nextState.phaseRemainingMs;

  if (mode === 'intent') {
    if (targetChanged) {
      target.targetX = nextState.targetX;
      target.targetY = nextState.targetY;
      target.speed = nextState.speed;
      target.pauseRemainingMs = nextState.pauseRemainingMs;
      target.facingLeft = nextState.facingLeft;
    }
    target.x = blend(target.x, nextState.x, SOFT_SYNC_POSITION_FACTOR);
    target.y = blend(target.y, nextState.y, SOFT_SYNC_POSITION_FACTOR);
    target.velocityX = blend(target.velocityX, nextState.velocityX, SOFT_SYNC_VELOCITY_FACTOR);
    target.velocityY = blend(target.velocityY, nextState.velocityY, SOFT_SYNC_VELOCITY_FACTOR);
    target.renderScale = blend(target.renderScale, nextState.renderScale, SOFT_SYNC_RENDER_SCALE_FACTOR);
    target.opacity = blend(target.opacity, nextState.opacity, SOFT_SYNC_OPACITY_FACTOR);
    target.actorMetrics = nextState.actorMetrics;
    return;
  }

  target.facingLeft = nextState.facingLeft;

  if (targetChanged) {
    target.targetX = nextState.targetX;
    target.targetY = nextState.targetY;
    target.speed = nextState.speed;
    target.pauseRemainingMs = nextState.pauseRemainingMs;
  } else {
    target.targetX = blend(target.targetX, nextState.targetX, SOFT_SYNC_TARGET_FACTOR);
    target.targetY = blend(target.targetY, nextState.targetY, SOFT_SYNC_TARGET_FACTOR);
    target.speed = blend(target.speed, nextState.speed, SOFT_SYNC_TARGET_FACTOR);
    target.pauseRemainingMs = Math.max(
      0,
      Math.round(blend(target.pauseRemainingMs, nextState.pauseRemainingMs, SOFT_SYNC_TARGET_FACTOR)),
    );
  }

  target.x = blend(target.x, nextState.x, SOFT_SYNC_POSITION_FACTOR);
  target.y = blend(target.y, nextState.y, SOFT_SYNC_POSITION_FACTOR);
  target.velocityX = blend(target.velocityX, nextState.velocityX, SOFT_SYNC_VELOCITY_FACTOR);
  target.velocityY = blend(target.velocityY, nextState.velocityY, SOFT_SYNC_VELOCITY_FACTOR);
  target.renderScale = blend(target.renderScale, nextState.renderScale, SOFT_SYNC_RENDER_SCALE_FACTOR);
  target.opacity = blend(target.opacity, nextState.opacity, SOFT_SYNC_OPACITY_FACTOR);
  target.actorMetrics = nextState.actorMetrics;
}

function imgSrc(userId: number | null) {
  return userId !== null ? `/api/companion/render-animated?user=${userId}` : DEFAULT_SRC;
}

function companionRenderSignature(companion?: CompanionPreviewSummary) {
  if (!companion) return 'none';

  const manifest = companion.renderManifest;
  const layerSignature = manifest.layers
    .map((layer) => {
      const sliceSignature = (layer.slices ?? [])
        .map((slice) => (
          `${slice.key}:${slice.targetX},${slice.targetY},${slice.targetWidth},${slice.targetHeight}`
        ))
        .join(';');
      return `${layer.key}:${layer.src}:${layer.zIndex}:${layer.slot ?? ''}:${layer.motionGroup ?? ''}:${sliceSignature}`;
    })
    .join('|');

  const actorMetricsSignature = JSON.stringify(companion.actorMetrics);
  return `${companion.animatedRenderUrl}|${manifest.width}x${manifest.height}|${actorMetricsSignature}|${layerSignature}`;
}

function buildFallbackMembers(
  mode: GhostlingSceneFallbackMode,
  fallbackCompanion?: CompanionPreviewSummary | null,
) {
  const nowIso = new Date().toISOString();
  const baseActivity: ScenePresenceActivity = {
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    freshness: 'steady',
    strength: 'medium',
  };
  const crowdSize = mode === 'crowd' ? 3 : 1;

  return Array.from({ length: crowdSize }, (_, index) => ({
    key: crowdSize === 1 ? 'fallback:house' : `fallback:house:${index + 1}`,
    userId: null,
    username: FALLBACK_NAMES[index] ?? `House Ghostling ${index + 1}`,
    displayName: FALLBACK_NAMES[index] ?? `House Ghostling ${index + 1}`,
    source: 'fallback',
    activity: baseActivity,
    companion: fallbackCompanion ?? undefined,
  })) satisfies ScenePresenceMember[];
}

function sceneStateForEntity(
  entity: GhostlingEntity,
  hoveredKey: string | null,
  nowTs: number,
  hasLiveMembers: boolean,
): SceneEntityState {
  if (entity.removing) return 'exiting';
  if (hoveredKey === entity.key) return 'hovered';
  if (entity.fallback && !hasLiveMembers) return 'featured-mascot';
  if (entity.activeUntilTs > nowTs) return 'live-active';
  if (entity.opacity < 0.999) return 'entering';
  return 'idle';
}

function sceneStateForRenderEntity(
  entity: RenderGhostlingEntity,
  hoveredKey: string | null,
  nowTs: number,
  hasLiveMembers: boolean,
): SceneEntityState {
  if (entity.removing) return 'exiting';
  if (hoveredKey === entity.key) return 'hovered';
  if (entity.fallback && !hasLiveMembers) return 'featured-mascot';
  if (entity.activeUntilTs > nowTs) return 'live-active';
  return 'idle';
}

function presentationForState(state: SceneEntityState): StagePresentation {
  if (state === 'hovered' || state === 'featured-mascot') return 'hero';
  if (state === 'live-active') return 'studio';
  return 'ambient';
}

function preferredSceneLabel(entity: Pick<RenderGhostlingEntity, 'source' | 'displayName' | 'username'>) {
  if (entity.displayName.trim()) {
    return entity.displayName.trim();
  }
  return entity.username;
}

function sourceMetadataLabel(source: ScenePresenceMember['source']) {
  if (source === 'voice') return 'Voice';
  if (source === 'wom') return 'Clan activity';
  return 'House ghostling';
}

function interactionMetadata(entity: RenderGhostlingEntity, nowTs: number) {
  const lines: string[] = [];
  const label = preferredSceneLabel(entity);
  if (entity.username && entity.username !== label) {
    lines.push(`@${entity.username}`);
  }

  if (entity.displayName && entity.displayName !== label && entity.displayName !== entity.username) {
    lines.push(entity.displayName);
  }

  lines.push(sourceMetadataLabel(entity.source));

  if (entity.activeUntilTs > nowTs) {
    lines.push('Live now');
  } else if (entity.fallback) {
    lines.push('Fallback');
  }

  return lines;
}

function isScenePresenceActive(
  entity: Pick<RenderGhostlingEntity, 'fallback' | 'source'>,
  sceneLabEnabled: boolean,
) {
  if (sceneLabEnabled || entity.fallback) return true;
  return entity.source === 'voice';
}

function scenePresenceVisualOpacity(options: {
  active: boolean;
  hovered: boolean;
}) {
  if (options.active || options.hovered) return 1;
  return 0.85;
}

function scenePresenceVisualTone(options: {
  active: boolean;
  hovered: boolean;
}) {
  if (options.active || options.hovered) {
    return {
      grayscale: 0,
      saturate: 1,
      brightness: 1,
    };
  }

  return {
    grayscale: 0.34,
    saturate: 0.58,
    brightness: 0.82,
  };
}

function liveBadgeLabel(source: ScenePresencePayload['source'], liveCount: number) {
  if (liveCount <= 0) return 'House mascot holding the stage';
  if (source === 'voice') return `${liveCount} live across voice and clan activity`;
  return `${liveCount} live from clan activity`;
}

function sharedSnapshotForPayload(
  payload: ScenePresencePayload | null,
  variant: GhostlingSceneVariant,
) {
  if (variant !== 'hero') return null;
  return payload?.sharedScene?.hero ?? null;
}

function stageRenderMetrics(
  desiredSize: number,
  manifest?: CompanionPreviewSummary['renderManifest'],
) {
  const logicalSize = Math.max(1, manifest?.width ?? 70, manifest?.height ?? 70);
  const integerScale = Math.max(1, Math.round(desiredSize / logicalSize));
  const targetSize = logicalSize * integerScale;
  return {
    desiredSize,
    targetSize,
    residualScale: desiredSize / targetSize,
  };
}

function WorldDebugOverlay({
  world,
  camera,
  bucket,
  members,
}: {
  world: GhostlingWorldSpec;
  camera: GhostlingSceneCameraMetrics;
  bucket: GhostlingSceneCameraMetrics['bucket'];
  members: RenderGhostlingEntity[];
}) {
  const safeZoneCounts = members.reduce<Record<string, number>>((counts, member) => {
    counts[member.safeZoneKey] = (counts[member.safeZoneKey] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <svg
      aria-hidden="true"
      className={styles.debugOverlay}
      viewBox={`0 0 ${world.sourceWidth} ${world.sourceHeight}`}
      preserveAspectRatio="xMidYMax meet"
      style={{
        left: `${camera.offsetX}px`,
        top: `${camera.offsetY}px`,
        width: `${camera.renderWidth}px`,
        height: `${camera.renderHeight}px`,
      }}
    >
      <rect
        x="0"
        y="0"
        width={world.sourceWidth}
        height={world.sourceHeight}
        fill="none"
        stroke="rgba(255,255,255,0.46)"
        strokeWidth="1"
      />
      <rect
        x={world.guides.safeArea.x}
        y={world.guides.safeArea.y}
        width={world.guides.safeArea.width}
        height={world.guides.safeArea.height}
        fill="none"
        stroke="rgba(133, 209, 255, 0.9)"
        strokeDasharray="6 4"
        strokeWidth="1"
      />
      <rect
        x={world.guides.centerSafe.x}
        y={world.guides.centerSafe.y}
        width={world.guides.centerSafe.width}
        height={world.guides.centerSafe.height}
        fill="none"
        stroke="rgba(126, 255, 211, 0.88)"
        strokeDasharray="10 4"
        strokeWidth="1"
      />
      <rect
        x={world.guides.ultrawideBleed.x}
        y={world.guides.ultrawideBleed.y}
        width={world.guides.ultrawideBleed.width}
        height={world.guides.ultrawideBleed.height}
        fill="none"
        stroke="rgba(255, 168, 112, 0.7)"
        strokeDasharray="12 6"
        strokeWidth="1"
      />
      {world.guides.heroCrop ? (
        <rect
          x={world.guides.heroCrop.x}
          y={world.guides.heroCrop.y}
          width={world.guides.heroCrop.width}
          height={world.guides.heroCrop.height}
          fill="rgba(255, 112, 154, 0.05)"
          stroke="rgba(255, 112, 154, 0.78)"
          strokeDasharray="8 4"
          strokeWidth="1.2"
        />
      ) : null}
      {world.guides.labelSafeTop ? (
        <rect
          x={world.guides.labelSafeTop.x}
          y={world.guides.labelSafeTop.y}
          width={world.guides.labelSafeTop.width}
          height={world.guides.labelSafeTop.height}
          fill="rgba(255, 225, 104, 0.06)"
          stroke="rgba(255, 225, 104, 0.48)"
          strokeDasharray="5 4"
          strokeWidth="1"
        />
      ) : null}
      <rect
        x={world.guides.debugFloorBand.x}
        y={world.guides.debugFloorBand.y}
        width={world.guides.debugFloorBand.width}
        height={world.guides.debugFloorBand.height}
        fill="rgba(132, 98, 255, 0.06)"
        stroke="rgba(132, 98, 255, 0.32)"
        strokeWidth="1"
      />
      <line
        x1="0"
        x2={world.sourceWidth}
        y1={world.horizonY}
        y2={world.horizonY}
        stroke="rgba(244, 225, 160, 0.72)"
        strokeDasharray="6 4"
        strokeWidth="1"
      />
      <line
        x1="0"
        x2={world.sourceWidth}
        y1={world.floorY}
        y2={world.floorY}
        stroke="rgba(255, 165, 102, 0.78)"
        strokeDasharray="8 5"
        strokeWidth="1.2"
      />
      <g>
        <rect
          x={12}
          y={12}
          width="240"
          height="44"
          rx="8"
          fill="rgba(8, 8, 11, 0.72)"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth="1"
        />
        <text
          x={22}
          y={30}
          fill="#f7fbff"
          fontSize="11"
          fontFamily="monospace"
        >
          {`bucket=${bucket} camera=${camera.guideMode} scale=${camera.scale.toFixed(3)}`}
        </text>
        <text
          x={22}
          y={45}
          fill="#d8e4ff"
          fontSize="10"
          fontFamily="monospace"
        >
          {`view x=${camera.worldViewport.x.toFixed(1)} w=${camera.worldViewport.width.toFixed(1)}`}
        </text>
      </g>
      {world.safeZones.map((safeZone) => (
        <g key={safeZone.key}>
          <rect
            x={safeZone.bounds.x}
            y={safeZone.bounds.y}
            width={safeZone.bounds.width}
            height={safeZone.bounds.height}
            rx="8"
            fill={safeZone.layer === 'front' ? 'rgba(255, 110, 160, 0.08)' : 'rgba(110, 196, 255, 0.08)'}
            stroke={safeZone.layer === 'front' ? 'rgba(255, 110, 160, 0.82)' : 'rgba(110, 196, 255, 0.82)'}
            strokeWidth="1"
          />
          <text
            x={safeZone.bounds.x + 6}
            y={safeZone.bounds.y + 14}
            fill="#f7fbff"
            fontSize="10"
            fontFamily="monospace"
          >
            {`${safeZone.label} (${safeZoneCounts[safeZone.key] ?? 0})`}
          </text>
        </g>
      ))}
      {world.points.map((point) => (
        <g key={point.key}>
          <circle cx={point.x} cy={point.y} r="3.2" fill={point.scaleTier === 3 ? '#ffc370' : '#95d8ff'} />
          <circle cx={point.x} cy={point.y} r="8" fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth="0.8" />
        </g>
      ))}
      <g>
        <circle cx={world.fallbackAnchor.x} cy={world.fallbackAnchor.y} r="4.5" fill="#ff8ea8" />
        <circle cx={world.fallbackAnchor.x} cy={world.fallbackAnchor.y} r="12" fill="none" stroke="#ff8ea8" strokeWidth="1" />
        <text
          x={world.fallbackAnchor.x + 10}
          y={world.fallbackAnchor.y - 8}
          fill="#ffe5ec"
          fontSize="10"
          fontFamily="monospace"
        >
          fallback
        </text>
      </g>
      {members.map((member) => (
        <g key={`member:${member.key}`}>
          {(() => {
            const actorMetrics = member.actorMetrics ?? DEFAULT_GHOSTLING_ACTOR_METRICS;
            const visibleExtents = scaledGhostlingVisibleExtents(member.renderScale, actorMetrics);
            const centerX = actorMetrics.sourceWidth / 2;
            const centerY = actorMetrics.sourceHeight / 2;
            const footprintWidth = actorMetrics.footprintBounds.width * member.renderScale;
            const footprintHeight = actorMetrics.footprintBounds.height * member.renderScale;
            const footprintX = member.x + ((actorMetrics.footprintBounds.x - centerX) * member.renderScale);
            const footprintY = member.y + ((actorMetrics.footprintBounds.y - centerY) * member.renderScale);

            return (
              <>
                <rect
                  x={member.x - visibleExtents.left}
                  y={member.y - visibleExtents.top}
                  width={visibleExtents.width}
                  height={visibleExtents.height}
                  fill="none"
                  stroke="rgba(246, 248, 255, 0.34)"
                  strokeDasharray="3 2"
                  strokeWidth="0.8"
                />
                <rect
                  x={footprintX}
                  y={footprintY}
                  width={footprintWidth}
                  height={footprintHeight}
                  fill="rgba(132, 202, 255, 0.12)"
                  stroke="rgba(132, 202, 255, 0.84)"
                  strokeWidth="0.9"
                />
              </>
            );
          })()}
          <line
            x1={member.x}
            y1={member.y}
            x2={member.targetX}
            y2={member.targetY}
            stroke="rgba(255,255,255,0.34)"
            strokeDasharray="4 3"
            strokeWidth="0.8"
          />
          <circle
            cx={member.targetX}
            cy={member.targetY}
            r="2.6"
            fill={member.source === 'voice' ? '#b6a3ff' : member.source === 'wom' ? '#78b8ff' : '#ffb8c5'}
          />
          <circle
            cx={member.x}
            cy={member.y}
            r={member.scaleTier === 3 ? 7 : 5}
            fill="none"
            stroke="rgba(255,255,255,0.84)"
            strokeWidth="1"
          />
          <text
            x={member.x + 8}
            y={member.y - 8}
            fill="#f5f8ff"
            fontSize="10"
            fontFamily="monospace"
          >
            {member.pointKey}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GhostlingScene({
  variant = 'section',
  overlay,
  fallbackMode = 'single',
  densityCaps,
  initialPayload = null,
  fallbackCompanion,
  world = 'shared-commons',
  preset = 'public-hero',
  worldSpec: injectedWorldSpec = null,
  tuningSpec: injectedTuningSpec = null,
  heroBucketOverride = null,
  debugWorldOverlay = false,
  sceneEditorEnabled = false,
  sceneEditorSandboxPayload = null,
  realtimeDisabled = false,
}: GhostlingSceneProps) {
  const worldSpec = injectedWorldSpec ?? ghostlingWorldById(world);
  const runtimeTuningSpec = useMemo(
    () => cloneGhostlingSceneTuningSpec(injectedTuningSpec ?? createDefaultGhostlingSceneTuningSpec()),
    [injectedTuningSpec],
  );
  const [sceneLabPreviewMode, setSceneLabPreviewMode] = useState<GhostlingSceneLabPreviewMode>(
    () => (initialPayload ? 'live' : 'sandbox'),
  );
  const [sceneLabPlaying, setSceneLabPlaying] = useState(true);
  const [sceneLabGhostCount, setSceneLabGhostCount] = useState(
    () => runtimeTuningSpec.buckets.desktop.maxVisible,
  );
  const [sceneLabResetSerial, setSceneLabResetSerial] = useState(0);
  const [sceneLabWorldDraft, setSceneLabWorldDraft] = useState<GhostlingWorldSpec>(() => cloneGhostlingWorldDraft(worldSpec));
  const [sceneLabTuningDraft, setSceneLabTuningDraft] = useState(() => cloneGhostlingSceneTuningSpec(runtimeTuningSpec));
  const [sceneLabSelection, setSceneLabSelection] = useState<GhostlingSceneLabSelection | null>(null);
  const [sceneLabActiveTab, setSceneLabActiveTab] = useState<GhostlingSceneLabTab>('authored');
  const [sceneLabSearchQuery, setSceneLabSearchQuery] = useState<GhostlingSceneLabSearchQuery>('');
  const [sceneLabUndoStack, setSceneLabUndoStack] = useState<GhostlingSceneLabSnapshot[]>([]);
  const [sceneLabRedoStack, setSceneLabRedoStack] = useState<GhostlingSceneLabSnapshot[]>([]);
  const [sceneLabLivePayload, setSceneLabLivePayload] = useState<ScenePresencePayload | null>(initialPayload);
  const [heroPanDragging, setHeroPanDragging] = useState(false);
  const [heroPanCanRecenter, setHeroPanCanRecenter] = useState(false);
  // Keep the first client render aligned with SSR; viewport detection runs after mount.
  const [heroPanMobileUi, setHeroPanMobileUi] = useState(false);
  const [heroViewportBucket, setHeroViewportBucket] = useState<GhostlingSceneDensityBucket>(
    heroBucketOverride ?? 'desktop',
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const entitiesRef = useRef<Map<string, GhostlingEntity>>(new Map());
  const wrapRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const visualRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const frameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const sceneLabStepFramesRef = useRef(0);
  const sceneLabWorldDraftRef = useRef(sceneLabWorldDraft);
  const sceneLabTuningDraftRef = useRef(sceneLabTuningDraft);
  const sceneLabUndoStackRef = useRef<GhostlingSceneLabSnapshot[]>([]);
  const sceneLabRedoStackRef = useRef<GhostlingSceneLabSnapshot[]>([]);
  const sceneLabPendingHistoryRef = useRef<GhostlingSceneLabSnapshot | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  const liveCountRef = useRef<number>(initialPayload?.members.length ?? 0);
  const lastPayloadRef = useRef<ScenePresencePayload | null>(initialPayload);
  const visibilityRef = useRef(true);
  const memberKeysStateRef = useRef<string[]>([]);
  const renderMembersStateRef = useRef<RenderGhostlingEntity[]>([]);
  const sceneLabEnabled = sceneEditorEnabled
    && isSharedHeroVariant(variant, world, preset);
  const heroPanEnabled = variant === 'hero' && !sceneLabEnabled;
  const heroPanCurrentXWorldRef = useRef(0);
  const heroPanTargetXWorldRef = useRef(0);
  const heroPanDragRef = useRef<HeroPanDragState | null>(null);
  const heroPanDraggingRef = useRef(false);
  const heroPanCanRecenterRef = useRef(false);
  const sceneWorldSpec = sceneLabEnabled ? sceneLabWorldDraft : worldSpec;
  const defaultCameraMetrics = useMemo(
    () => createGhostlingSceneCameraMetrics(
      sceneWorldSpec,
      sceneWorldSpec.sourceWidth,
      sceneWorldSpec.sourceHeight,
      'desktop',
      cameraLayoutForVariant(variant),
    ),
    [sceneWorldSpec, variant],
  );
  const renderMetricsStateRef = useRef<GhostlingSceneCameraMetrics>(defaultCameraMetrics);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [memberKeys, setMemberKeys] = useState<string[]>([]);
  const [renderMembers, setRenderMembers] = useState<RenderGhostlingEntity[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [payloadSource, setPayloadSource] = useState<ScenePresencePayload['source']>(initialPayload?.source ?? 'empty');
  const [liveCount, setLiveCount] = useState<number>(initialPayload?.members.length ?? 0);
  const [renderNow, setRenderNow] = useState(0);
  const [renderMetrics, setRenderMetrics] = useState<GhostlingSceneCameraMetrics>(defaultCameraMetrics);
  const heroStageCrop = variant === 'hero'
    ? resolveGhostlingHeroCrop(sceneWorldSpec, heroViewportBucket)
    : null;
  const heroStageAspectRatio = heroStageCrop
    ? `${Math.max(1, heroStageCrop.width)} / ${Math.max(1, heroStageCrop.height)}`
    : null;

  const worldDebugOverlayEnabled = process.env.NODE_ENV !== 'production'
    && debugWorldOverlay
    && !sceneLabEnabled;
  const motionDebugEnabled = worldDebugOverlayEnabled || sceneLabEnabled;
  const hasLiveMembers = liveCount > 0;
  const realtimeEnabled = !sceneLabEnabled && !realtimeDisabled && variant === 'hero' && world === 'shared-commons' && preset === 'public-hero';
  const authoritativeHeroMode = isSharedHeroVariant(variant, world, preset) && !sceneLabEnabled && !realtimeDisabled;
  const sceneLabSandboxPayload = useMemo(() => (
    sceneEditorSandboxPayload && sceneLabGhostCount === (sceneEditorSandboxPayload.members.length || 0)
      ? sceneEditorSandboxPayload
      : buildHomePageSceneFixture(
          'visual-baseline',
          fallbackCompanion,
          sceneLabGhostCount,
          worldSpec,
        )
  ), [fallbackCompanion, sceneEditorSandboxPayload, sceneLabGhostCount, worldSpec]);
  const sceneLabActivePayload = useMemo(() => (
    sceneLabPreviewMode === 'live'
      ? (sceneLabLivePayload ?? initialPayload ?? sceneLabSandboxPayload)
      : sceneLabSandboxPayload
  ), [initialPayload, sceneLabLivePayload, sceneLabPreviewMode, sceneLabSandboxPayload]);
  const sceneLabGhostCountMax = useMemo(
    () => Math.max(
      1,
      sceneWorldSpec.viewports.desktop.pointOrder.length,
      sceneLabTuningDraft.buckets.desktop.maxVisible,
    ),
    [sceneLabTuningDraft.buckets.desktop.maxVisible, sceneWorldSpec.viewports.desktop.pointOrder.length],
  );

  useEffect(() => {
    sceneLabWorldDraftRef.current = sceneLabWorldDraft;
  }, [sceneLabWorldDraft]);

  useEffect(() => {
    sceneLabTuningDraftRef.current = sceneLabTuningDraft;
  }, [sceneLabTuningDraft]);

  useEffect(() => {
    sceneLabUndoStackRef.current = sceneLabUndoStack;
  }, [sceneLabUndoStack]);

  useEffect(() => {
    sceneLabRedoStackRef.current = sceneLabRedoStack;
  }, [sceneLabRedoStack]);

  useEffect(() => {
    if (!sceneLabEnabled) return;
    setSceneLabPreviewMode(initialPayload ? 'live' : 'sandbox');
  }, [initialPayload, sceneLabEnabled]);

  const clearHoveredGhostling = useCallback(() => {
    hoveredKeyRef.current = null;
    setHoveredKey(null);
  }, []);

  const triggerHeroPanRecenter = useCallback(() => {
    if (!heroPanEnabled) return;
    if (heroPanDraggingRef.current) return;
    const currentPanX = heroPanCurrentXWorldRef.current;
    if (Math.abs(currentPanX) < 0.5) return;
    heroPanTargetXWorldRef.current = 0;
    clearHoveredGhostling();
  }, [clearHoveredGhostling, heroPanEnabled]);

  useEffect(() => {
    heroPanDraggingRef.current = heroPanDragging;
  }, [heroPanDragging]);

  useEffect(() => {
    heroPanCanRecenterRef.current = heroPanCanRecenter;
  }, [heroPanCanRecenter]);

  useEffect(() => {
    if (heroPanEnabled) return;
    heroPanCurrentXWorldRef.current = 0;
    heroPanTargetXWorldRef.current = 0;
    heroPanDragRef.current = null;
    heroPanDraggingRef.current = false;
    heroPanCanRecenterRef.current = false;
    setHeroPanDragging(false);
    setHeroPanCanRecenter(false);
    setHeroPanMobileUi(false);
    setHeroViewportBucket(heroBucketOverride ?? 'desktop');
  }, [heroBucketOverride, heroPanEnabled]);

  useEffect(() => {
    if (!heroPanEnabled || typeof window === 'undefined') return undefined;
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const noHoverQuery = window.matchMedia('(hover: none)');
    const sync = () => {
      setHeroPanMobileUi(detectHeroMobileViewport());
      setHeroViewportBucket(resolveHeroBucketPreference(window.innerWidth, heroBucketOverride));
    };

    sync();
    window.addEventListener('resize', sync);

    if (
      typeof coarsePointerQuery.addEventListener === 'function'
      && typeof noHoverQuery.addEventListener === 'function'
    ) {
      coarsePointerQuery.addEventListener('change', sync);
      noHoverQuery.addEventListener('change', sync);
      return () => {
        window.removeEventListener('resize', sync);
        coarsePointerQuery.removeEventListener('change', sync);
        noHoverQuery.removeEventListener('change', sync);
      };
    }

    coarsePointerQuery.addListener(sync);
    noHoverQuery.addListener(sync);
    return () => {
      window.removeEventListener('resize', sync);
      coarsePointerQuery.removeListener(sync);
      noHoverQuery.removeListener(sync);
    };
  }, [heroBucketOverride, heroPanEnabled]);

  const createSceneLabSnapshot = useCallback(() => cloneGhostlingSceneLabSnapshot({
    worldDraft: sceneLabWorldDraftRef.current,
    tuningDraft: sceneLabTuningDraftRef.current,
  }), []);

  const applySceneLabSnapshot = useCallback((snapshot: GhostlingSceneLabSnapshot) => {
    const nextSnapshot = cloneGhostlingSceneLabSnapshot(snapshot);
    sceneLabWorldDraftRef.current = nextSnapshot.worldDraft;
    sceneLabTuningDraftRef.current = nextSnapshot.tuningDraft;
    setSceneLabWorldDraft(nextSnapshot.worldDraft);
    setSceneLabTuningDraft(nextSnapshot.tuningDraft);
  }, []);

  const resetSceneLabRedoStack = useCallback(() => {
    sceneLabRedoStackRef.current = [];
    setSceneLabRedoStack([]);
  }, []);

  const pushSceneLabUndoSnapshot = useCallback((snapshot: GhostlingSceneLabSnapshot) => {
    const nextUndo = [
      ...sceneLabUndoStackRef.current,
      cloneGhostlingSceneLabSnapshot(snapshot),
    ].slice(-SCENE_LAB_HISTORY_LIMIT);
    sceneLabUndoStackRef.current = nextUndo;
    setSceneLabUndoStack(nextUndo);
    resetSceneLabRedoStack();
  }, [resetSceneLabRedoStack]);

  const applySceneLabDrafts = useCallback((options: {
    worldUpdate?: SceneLabDraftUpdate<GhostlingWorldSpec>;
    tuningUpdate?: SceneLabDraftUpdate<GhostlingSceneTuningSpec>;
    history?: SceneLabHistoryMode;
  }) => {
    const currentSnapshot = createSceneLabSnapshot();
    const nextSnapshot = {
      worldDraft: options.worldUpdate
        ? resolveDraftUpdate(options.worldUpdate, currentSnapshot.worldDraft)
        : currentSnapshot.worldDraft,
      tuningDraft: options.tuningUpdate
        ? resolveDraftUpdate(options.tuningUpdate, currentSnapshot.tuningDraft)
        : currentSnapshot.tuningDraft,
    } satisfies GhostlingSceneLabSnapshot;

    if (ghostlingSceneLabSnapshotEquals(currentSnapshot, nextSnapshot)) {
      return false;
    }

    if (options.history === 'immediate') {
      pushSceneLabUndoSnapshot(currentSnapshot);
    }

    sceneLabWorldDraftRef.current = nextSnapshot.worldDraft;
    sceneLabTuningDraftRef.current = nextSnapshot.tuningDraft;
    setSceneLabWorldDraft(nextSnapshot.worldDraft);
    setSceneLabTuningDraft(nextSnapshot.tuningDraft);
    return true;
  }, [createSceneLabSnapshot, pushSceneLabUndoSnapshot]);

  const beginSceneLabHistoryCapture = useCallback(() => {
    if (!sceneLabPendingHistoryRef.current) {
      sceneLabPendingHistoryRef.current = createSceneLabSnapshot();
    }
  }, [createSceneLabSnapshot]);

  const commitSceneLabHistoryCapture = useCallback(() => {
    const pendingSnapshot = sceneLabPendingHistoryRef.current;
    sceneLabPendingHistoryRef.current = null;
    if (!pendingSnapshot) return;

    const currentSnapshot = createSceneLabSnapshot();
    if (ghostlingSceneLabSnapshotEquals(pendingSnapshot, currentSnapshot)) {
      return;
    }

    pushSceneLabUndoSnapshot(pendingSnapshot);
  }, [createSceneLabSnapshot, pushSceneLabUndoSnapshot]);

  const cancelSceneLabHistoryCapture = useCallback(() => {
    sceneLabPendingHistoryRef.current = null;
  }, []);

  const undoSceneLabEdit = useCallback(() => {
    const previousSnapshot = sceneLabUndoStackRef.current.at(-1);
    if (!previousSnapshot) return;

    const presentSnapshot = createSceneLabSnapshot();
    const nextUndo = sceneLabUndoStackRef.current.slice(0, -1);
    const nextRedo = [
      ...sceneLabRedoStackRef.current,
      cloneGhostlingSceneLabSnapshot(presentSnapshot),
    ].slice(-SCENE_LAB_HISTORY_LIMIT);

    sceneLabUndoStackRef.current = nextUndo;
    sceneLabRedoStackRef.current = nextRedo;
    setSceneLabUndoStack(nextUndo);
    setSceneLabRedoStack(nextRedo);
    sceneLabPendingHistoryRef.current = null;
    applySceneLabSnapshot(previousSnapshot);
  }, [applySceneLabSnapshot, createSceneLabSnapshot]);

  const redoSceneLabEdit = useCallback(() => {
    const nextSnapshot = sceneLabRedoStackRef.current.at(-1);
    if (!nextSnapshot) return;

    const presentSnapshot = createSceneLabSnapshot();
    const nextRedo = sceneLabRedoStackRef.current.slice(0, -1);
    const nextUndo = [
      ...sceneLabUndoStackRef.current,
      cloneGhostlingSceneLabSnapshot(presentSnapshot),
    ].slice(-SCENE_LAB_HISTORY_LIMIT);

    sceneLabUndoStackRef.current = nextUndo;
    sceneLabRedoStackRef.current = nextRedo;
    setSceneLabUndoStack(nextUndo);
    setSceneLabRedoStack(nextRedo);
    sceneLabPendingHistoryRef.current = null;
    applySceneLabSnapshot(nextSnapshot);
  }, [applySceneLabSnapshot, createSceneLabSnapshot]);

  const selectSceneLabItem = useCallback((selection: GhostlingSceneLabSelection | null) => {
    setSceneLabSelection(selection);
    if (!selection) return;
    setSceneLabActiveTab(selection.kind === 'member' ? 'members' : 'authored');
  }, []);

  const updateSceneLabWorldDraft = useCallback((
    update: SceneLabDraftUpdate<GhostlingWorldSpec>,
    options?: { history?: SceneLabHistoryMode },
  ) => applySceneLabDrafts({
    worldUpdate: update,
    history: options?.history ?? 'immediate',
  }), [applySceneLabDrafts]);

  const updateSceneLabTuningDraft = useCallback((
    update: SceneLabDraftUpdate<GhostlingSceneTuningSpec>,
    options?: { history?: SceneLabHistoryMode },
  ) => applySceneLabDrafts({
    tuningUpdate: update,
    history: options?.history ?? 'immediate',
  }), [applySceneLabDrafts]);

  useEffect(() => {
    const nextWorldDraft = cloneGhostlingWorldDraft(worldSpec);
    const nextTuningDraft = cloneGhostlingSceneTuningSpec(runtimeTuningSpec);
    sceneLabWorldDraftRef.current = nextWorldDraft;
    sceneLabTuningDraftRef.current = nextTuningDraft;
    sceneLabUndoStackRef.current = [];
    sceneLabRedoStackRef.current = [];
    sceneLabPendingHistoryRef.current = null;
    setSceneLabWorldDraft(nextWorldDraft);
    setSceneLabTuningDraft(nextTuningDraft);
    setSceneLabGhostCount(nextTuningDraft.buckets.desktop.maxVisible);
    setSceneLabSelection(null);
    setSceneLabActiveTab('authored');
    setSceneLabSearchQuery('');
    setSceneLabUndoStack([]);
    setSceneLabRedoStack([]);
  }, [runtimeTuningSpec, worldSpec]);

  useEffect(() => {
    setSceneLabGhostCount((current) => Math.min(current, sceneLabGhostCountMax));
  }, [sceneLabGhostCountMax]);

  useEffect(() => {
    setSceneLabLivePayload(initialPayload);
  }, [initialPayload]);

  useEffect(() => {
    if (!sceneLabEnabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = event.ctrlKey || event.metaKey;
      if (!modifierPressed || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoSceneLabEdit();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redoSceneLabEdit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redoSceneLabEdit, sceneLabEnabled, undoSceneLabEdit]);

  const commitMemberKeys = useCallback((nextKeys: string[]) => {
    if (sameStringArray(memberKeysStateRef.current, nextKeys)) {
      return false;
    }
    memberKeysStateRef.current = nextKeys;
    setMemberKeys(nextKeys);
    return true;
  }, []);

  const commitRenderMembers = useCallback((
    nextMembers: RenderGhostlingEntity[],
    includeMotion = false,
  ) => {
    if (sameRenderMembers(renderMembersStateRef.current, nextMembers, includeMotion)) {
      return false;
    }
    renderMembersStateRef.current = nextMembers;
    setRenderMembers(nextMembers);
    return true;
  }, []);

  const commitRenderMetrics = useCallback((
    nextMetrics: GhostlingSceneCameraMetrics,
  ) => {
    if (sameRenderMetrics(renderMetricsStateRef.current, nextMetrics)) {
      return false;
    }
    renderMetricsStateRef.current = nextMetrics;
    setRenderMetrics(nextMetrics);
    return true;
  }, []);

  const snapshotRenderMembers = useCallback(() => (
    Array.from(entitiesRef.current.values()).map((entity) => ({
      key: entity.key,
      username: entity.username,
      displayName: entity.displayName,
      imgSrc: entity.imgSrc,
      companion: entity.companion,
      companionSignature: entity.companionSignature,
      source: entity.source,
      fallback: entity.fallback,
      activeUntilTs: entity.activeUntilTs,
      removing: entity.removing,
      x: authoritativeHeroMode ? entity.displayX : entity.x,
      y: authoritativeHeroMode ? entity.displayY : entity.y,
      targetX: entity.targetX,
      targetY: entity.targetY,
      opacity: authoritativeHeroMode ? entity.displayOpacity : entity.opacity,
      facingLeft: authoritativeHeroMode ? entity.displayFacingLeft : entity.facingLeft,
      safeZoneKey: entity.safeZoneKey,
      pointKey: entity.pointKey,
      scaleTier: entity.scaleTier,
      renderScale: authoritativeHeroMode ? entity.displayRenderScale : entity.renderScale,
      speed: entity.speed,
      velocityX: entity.velocityX,
      velocityY: entity.velocityY,
      movementPhase: entity.movementPhase,
      actorMetrics: entity.actorMetrics,
    }))
  ), [authoritativeHeroMode]);

  useEffect(() => {
    hoveredKeyRef.current = hoveredKey;
  }, [hoveredKey]);

  const stageSize = useCallback(() => {
    const el = containerRef.current;
    const width = el && el.clientWidth > 0 ? el.clientWidth : 1260;
    const height = el && el.clientHeight > 0 ? el.clientHeight : sceneWorldSpec.sourceHeight;
    return {
      width,
      height,
    };
  }, [sceneWorldSpec]);

  const onHeroStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!heroPanEnabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    heroPanDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startPanXWorld: heroPanCurrentXWorldRef.current,
      thresholdExceeded: false,
    };

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, [heroPanEnabled]);

  const onHeroStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!heroPanEnabled) return;
    const drag = heroPanDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    if (!drag.thresholdExceeded && Math.abs(deltaX) < HERO_PAN_DRAG_THRESHOLD_PX) {
      return;
    }

    if (!drag.thresholdExceeded) {
      drag.thresholdExceeded = true;
      heroPanDraggingRef.current = true;
      setHeroPanDragging(true);
      clearHoveredGhostling();
    }

    const scaleX = Math.max(0.001, renderMetricsStateRef.current.scaleX);
    const nextPanXWorld = drag.startPanXWorld - (deltaX / scaleX);
    heroPanCurrentXWorldRef.current = nextPanXWorld;
    heroPanTargetXWorldRef.current = nextPanXWorld;
  }, [clearHoveredGhostling, heroPanEnabled]);

  const endHeroStagePointerDrag = useCallback((pointerId: number) => {
    const drag = heroPanDragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    heroPanDragRef.current = null;
    if (heroPanDraggingRef.current) {
      heroPanDraggingRef.current = false;
      setHeroPanDragging(false);
    }
  }, []);

  const onHeroStagePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    endHeroStagePointerDrag(event.pointerId);
    if (
      typeof event.currentTarget.hasPointerCapture === 'function'
      && typeof event.currentTarget.releasePointerCapture === 'function'
      && event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [endHeroStagePointerDrag]);

  const onHeroStagePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    endHeroStagePointerDrag(event.pointerId);
  }, [endHeroStagePointerDrag]);

  const onHeroStageDoubleClick = useCallback(() => {
    triggerHeroPanRecenter();
  }, [triggerHeroPanRecenter]);

  const handleHeroStageWheelDelta = useCallback((options: {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    stageWidth: number;
  }) => {
    if (!heroPanEnabled) return;
    if (heroPanDraggingRef.current) return;

    const dominantDelta = Math.abs(options.deltaX) >= 0.5
      ? options.deltaX
      : options.deltaY;
    if (Math.abs(dominantDelta) < 0.5) return;

    const normalizedDelta = normalizeHeroWheelDelta(
      dominantDelta,
      options.deltaMode,
      Math.max(1, options.stageWidth),
    );
    if (Math.abs(normalizedDelta) < 0.5) return;

    clearHoveredGhostling();

    const scaleX = Math.max(0.001, renderMetricsStateRef.current.scaleX);
    heroPanTargetXWorldRef.current += normalizedDelta / scaleX;
    return true;
  }, [clearHoveredGhostling, heroPanEnabled]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !heroPanEnabled) return undefined;

    const onWheel = (event: WheelEvent) => {
      const consumed = handleHeroStageWheelDelta({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        stageWidth: stage.clientWidth,
      });
      if (consumed) {
        event.preventDefault();
      }
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [handleHeroStageWheelDelta, heroPanEnabled]);

  const syncMembers = useCallback((
    payload: ScenePresencePayload | null,
    options: { correctionMode?: SharedSceneCorrectionMode } = {},
  ) => {
    const nowTs = Date.now();
    const size = stageSize();
    const profile = resolveGhostlingSceneProfile(
      size.width,
      variant,
      densityCaps,
      sceneLabEnabled ? sceneLabTuningDraft : runtimeTuningSpec,
      sceneWorldSpec,
      variant === 'hero' ? heroViewportBucket : undefined,
    );
    const metrics = createGhostlingSceneCameraMetrics(
      sceneWorldSpec,
      size.width,
      size.height,
      profile.bucket,
      cameraLayoutForVariant(variant),
      heroPanEnabled ? { panXWorld: heroPanCurrentXWorldRef.current } : undefined,
    );
    if (heroPanEnabled) {
      heroPanCurrentXWorldRef.current = metrics.panXWorld;
      heroPanTargetXWorldRef.current = metrics.panXWorld;
      const nextCanRecenter = Math.abs(metrics.panXWorld) > HERO_RECENTER_VISIBILITY_THRESHOLD;
      if (nextCanRecenter !== heroPanCanRecenterRef.current) {
        heroPanCanRecenterRef.current = nextCanRecenter;
        setHeroPanCanRecenter(nextCanRecenter);
      }
    }
    const sharedSnapshot = sceneLabEnabled ? null : sharedSnapshotForPayload(payload, variant);
    const sharedSnapshotEntities = sharedSnapshot
      ? new Map(sharedSnapshot.entities.map((entity) => [entity.key, entity]))
      : null;
    const sharedSampleAt = sharedSnapshot?.savedAt ?? nowTs;
    const correctionMode = options.correctionMode ?? 'snap';
    const actualMembers = payload?.members ?? [];
    const effectiveMembers = (actualMembers.length > 0 ? actualMembers : buildFallbackMembers(fallbackMode, fallbackCompanion))
      .slice(0, profile.maxVisible);
    const entities = entitiesRef.current;
    const bootstrapping = entities.size === 0;
    const incomingKeys = new Set(effectiveMembers.map((member) => member.key));
    let renderStateChanged = bootstrapping;

    lastPayloadRef.current = payload;
    liveCountRef.current = actualMembers.length;

    for (const [key, entity] of entities.entries()) {
      if (!incomingKeys.has(key) && !entity.removing) {
        if (authoritativeHeroMode) {
          entities.delete(key);
          wrapRefs.current.delete(key);
          visualRefs.current.delete(key);
        } else {
          entity.removing = true;
        }
        renderStateChanged = true;
      }
    }

    for (const [memberIndex, member] of effectiveMembers.entries()) {
      const existing = entities.get(member.key);
      const preferredPointKey = preferredGhostlingScenePointKey(
        profile,
        memberIndex,
        member.source === 'fallback',
        member.source,
      );
      const signature = `${member.activity.lastSeenAt}:${member.source}`;
      const restoredEntity = sharedSnapshotEntities?.get(member.key);
      const scenePeers = Array.from(entities.values())
        .filter((entity) => !entity.removing && entity.key !== member.key)
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
        }));

      if (!existing) {
        let motion = restoredEntity
          ? restoreSharedSceneEntity(
              restoredEntity,
              sharedSnapshot?.width ?? sceneWorldSpec.sourceWidth,
              sharedSnapshot?.height ?? sceneWorldSpec.sourceHeight,
              sceneWorldSpec,
            )
          : createGhostlingSceneMotionState(
              member.key,
              sceneWorldSpec,
              profile,
              preferredPointKey,
              {
                fallback: member.source === 'fallback',
                source: member.source,
                peers: scenePeers,
                actorMetrics: member.companion?.actorMetrics,
              },
            );
        const restoredDisplayState = authoritativeHeroMode
          ? {
              x: motion.x,
              y: motion.y,
              renderScale: motion.renderScale,
              facingLeft: motion.facingLeft,
              opacity: motion.opacity,
            }
          : null;
        let forceSmoothHeroRestore = false;
        if (member.source === 'fallback' || !profile.allowedPointKeys.has(motion.pointKey)) {
          motion = rehomeGhostlingSceneEntity(
            motion,
            sceneWorldSpec,
            profile,
            preferredPointKey,
            {
              fallback: member.source === 'fallback',
              source: member.source,
              peers: scenePeers,
            },
          );
          forceSmoothHeroRestore = authoritativeHeroMode && restoredEntity !== undefined;
        }
        if (authoritativeHeroMode || (bootstrapping && !restoredEntity)) {
          motion.opacity = 1;
        }
        motion.renderScale = restoredEntity?.renderScale ?? motion.renderScale;
        const nextEntity: GhostlingEntity = {
          ...motion,
          username: member.username,
          displayName: member.displayName,
          imgSrc: member.companion?.animatedRenderUrl ?? imgSrc(member.userId),
          companion: member.companion,
          companionSignature: companionRenderSignature(member.companion),
          source: member.source,
          activity: member.activity,
          removing: false,
          fallback: member.source === 'fallback',
          activeUntilTs: restoredEntity?.activeUntilTs ?? (member.activity.freshness === 'new' ? nowTs + LIVE_ACTIVE_MS : 0),
          lastSeenSignature: restoredEntity?.lastSeenSignature ?? signature,
          actorMetrics: motion.actorMetrics,
          displayX: restoredDisplayState?.x ?? motion.x,
          displayY: restoredDisplayState?.y ?? motion.y,
          displayRenderScale: restoredDisplayState?.renderScale ?? motion.renderScale,
          displayFacingLeft: restoredDisplayState?.facingLeft ?? motion.facingLeft,
          displayOpacity: restoredDisplayState?.opacity ?? motion.opacity,
          heroSamples: [],
        };
        if (authoritativeHeroMode) {
          pushHeroSample(
            nextEntity,
            heroSampleFromSceneEntity(motion, sharedSampleAt),
            { forceSmooth: forceSmoothHeroRestore },
          );
        } else {
          nextEntity.displayX = nextEntity.x;
          nextEntity.displayY = nextEntity.y;
          nextEntity.displayRenderScale = nextEntity.renderScale;
          nextEntity.displayFacingLeft = nextEntity.facingLeft;
          nextEntity.displayOpacity = nextEntity.opacity;
        }
        entities.set(member.key, nextEntity);
        renderStateChanged = true;
        continue;
      }

      const previousUsername = existing.username;
      const previousDisplayName = existing.displayName;
      const previousImgSrc = existing.imgSrc;
      const previousCompanionSignature = existing.companionSignature;
      const previousSource = existing.source;
      const previousFallback = existing.fallback;
      const previousActiveUntilTs = existing.activeUntilTs;
      const previousRemoving = existing.removing;

      if (authoritativeHeroMode) {
        let forceSmoothHeroRestore = false;
        if (restoredEntity) {
          const restoredMotion = restoreSharedSceneEntity(
            restoredEntity,
            sharedSnapshot?.width ?? sceneWorldSpec.sourceWidth,
            sharedSnapshot?.height ?? sceneWorldSpec.sourceHeight,
            sceneWorldSpec,
          );
          const authoritativeMotion = member.source === 'fallback' || !profile.allowedPointKeys.has(restoredMotion.pointKey)
            ? rehomeGhostlingSceneEntity(
                restoredMotion,
                sceneWorldSpec,
                profile,
                preferredPointKey,
                {
                  fallback: member.source === 'fallback',
                  source: member.source,
                  peers: scenePeers,
                },
              )
            : restoredMotion;
          if (authoritativeMotion !== restoredMotion) {
            forceSmoothHeroRestore = true;
          }
          pushHeroSample(
            existing,
            heroSampleFromSceneEntity(authoritativeMotion, sharedSampleAt),
            { forceSmooth: forceSmoothHeroRestore },
          );
          existing.activeUntilTs = restoredEntity.activeUntilTs;
          existing.lastSeenSignature = restoredEntity.lastSeenSignature;
        } else if (existing.heroSamples.length === 0) {
          pushHeroSample(existing, currentHeroSceneSample(existing, nowTs));
        } else if (member.source === 'fallback' || !profile.allowedPointKeys.has(existing.pointKey)) {
          const rehomed = rehomeGhostlingSceneEntity(
            existing,
            sceneWorldSpec,
            profile,
            preferredPointKey,
            {
              fallback: member.source === 'fallback',
              source: member.source,
              peers: scenePeers,
            },
          );
          pushHeroSample(
            existing,
            currentHeroSceneSample(rehomed, nowTs),
            { forceSmooth: true },
          );
        }
      } else if (restoredEntity) {
        applySharedSceneEntity(
          existing,
          restoredEntity,
          sharedSnapshot?.width ?? sceneWorldSpec.sourceWidth,
          sharedSnapshot?.height ?? sceneWorldSpec.sourceHeight,
          sceneWorldSpec,
          { mode: correctionMode },
        );
      }

      existing.username = member.username;
      existing.displayName = member.displayName;
      existing.imgSrc = member.companion?.animatedRenderUrl ?? imgSrc(member.userId);
      existing.companion = member.companion;
      existing.companionSignature = companionRenderSignature(member.companion);
      existing.actorMetrics = member.companion?.actorMetrics ?? existing.actorMetrics;
      existing.source = member.source;
      existing.activity = member.activity;
      existing.removing = false;
      existing.fallback = member.source === 'fallback';

      if (!authoritativeHeroMode && (member.source === 'fallback' || !profile.allowedPointKeys.has(existing.pointKey))) {
        Object.assign(
          existing,
          rehomeGhostlingSceneEntity(
            existing,
            sceneWorldSpec,
            profile,
            preferredPointKey,
            {
              fallback: member.source === 'fallback',
              source: member.source,
              peers: scenePeers,
            },
          ),
        );
      }

      if (!restoredEntity && existing.lastSeenSignature !== signature && member.activity.freshness === 'new') {
        existing.activeUntilTs = nowTs + LIVE_ACTIVE_MS;
      }

      existing.lastSeenSignature = restoredEntity?.lastSeenSignature ?? signature;

      if (
        previousUsername !== existing.username
        || previousDisplayName !== existing.displayName
        || previousImgSrc !== existing.imgSrc
        || previousCompanionSignature !== existing.companionSignature
        || previousSource !== existing.source
        || previousFallback !== existing.fallback
        || previousActiveUntilTs !== existing.activeUntilTs
        || previousRemoving !== existing.removing
      ) {
        renderStateChanged = true;
      }
    }

    setPayloadSource(payload?.source ?? 'empty');
    setLiveCount(actualMembers.length);
    const metricsChanged = commitRenderMetrics(metrics);
    const keysChanged = commitMemberKeys(Array.from(entities.keys()));

    if (renderStateChanged || metricsChanged || keysChanged || motionDebugEnabled) {
      commitRenderMembers(snapshotRenderMembers(), motionDebugEnabled);
    }

    if (renderStateChanged || keysChanged) {
      setRenderNow(nowTs);
    }
  }, [
    commitMemberKeys,
    commitRenderMembers,
    commitRenderMetrics,
    densityCaps,
    fallbackCompanion,
    fallbackMode,
    authoritativeHeroMode,
    heroViewportBucket,
    snapshotRenderMembers,
    stageSize,
    variant,
    motionDebugEnabled,
    heroPanEnabled,
    sceneLabEnabled,
    sceneLabTuningDraft,
    runtimeTuningSpec,
    sceneWorldSpec,
  ]);

  const fetchPresence = useCallback(async (
    options?: { clearOnFailure?: boolean },
  ) => {
    const clearOnFailure = options?.clearOnFailure ?? true;

    try {
      const response = await fetch('/api/scene/presence');
      if (!response.ok) {
        if (clearOnFailure || !lastPayloadRef.current) {
          const emptyPayload = { members: [], source: 'empty' } satisfies ScenePresencePayload;
          setSceneLabLivePayload(emptyPayload);
          syncMembers(emptyPayload);
        }
        return false;
      }
      const payload = await response.json() as ScenePresencePayload;
      setSceneLabLivePayload(payload);
      syncMembers(payload);
      return true;
    } catch {
      if (clearOnFailure || !lastPayloadRef.current) {
        const emptyPayload = { members: [], source: 'empty' } satisfies ScenePresencePayload;
        setSceneLabLivePayload(emptyPayload);
        syncMembers(emptyPayload);
      }
      return false;
    }
  }, [syncMembers]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  useEffect(() => {
    if (sceneLabEnabled) {
      if (sceneLabPreviewMode === 'live') {
        void fetchPresence({ clearOnFailure: false });
      }
      return undefined;
    }

    let initialFetchTimeout = 0;
    let pollId = 0;
    let fallbackPollTimeoutId = 0;
    let fallbackPollingActive = false;
    let reconnectTimeoutId = 0;
    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let disposed = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutId > 0) {
        window.clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = 0;
      }
    };

    const stopFallbackPolling = () => {
      fallbackPollingActive = false;
      if (initialFetchTimeout > 0) {
        window.clearTimeout(initialFetchTimeout);
        initialFetchTimeout = 0;
      }
      if (pollId > 0) {
        window.clearInterval(pollId);
        pollId = 0;
      }
      if (fallbackPollTimeoutId > 0) {
        window.clearTimeout(fallbackPollTimeoutId);
        fallbackPollTimeoutId = 0;
      }
    };

    const queueFallbackPoll = (delayMs: number) => {
      if (!fallbackPollingActive || fallbackPollTimeoutId > 0) {
        return;
      }

      fallbackPollTimeoutId = window.setTimeout(() => {
        fallbackPollTimeoutId = 0;
        void fetchPresence({ clearOnFailure: false }).finally(() => {
          if (!disposed && fallbackPollingActive) {
            queueFallbackPoll(POLL_MS);
          }
        });
      }, delayMs);
    };

    const startFallbackPolling = (immediate = false) => {
      if (fallbackPollingActive) return;
      fallbackPollingActive = true;
      queueFallbackPoll(immediate || !lastPayloadRef.current ? 0 : POLL_MS);
    };

    const scheduleReconnect = () => {
      if (!realtimeEnabled || reconnectTimeoutId > 0 || disposed || document.visibilityState === 'hidden') {
        return;
      }

      const delay = Math.min(
        SOCKET_RECONNECT_MAX_MS,
        SOCKET_RECONNECT_BASE_MS * (2 ** reconnectAttempts),
      );
      reconnectAttempts += 1;
      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = 0;
        connectSocket();
      }, delay);
    };

    const closeSocket = () => {
      if (!socket) return;
      const activeSocket = socket;
      socket = null;
      activeSocket.onopen = null;
      activeSocket.onmessage = null;
      activeSocket.onerror = null;
      activeSocket.onclose = null;

      if (
        activeSocket.readyState === window.WebSocket.OPEN
        || activeSocket.readyState === window.WebSocket.CONNECTING
      ) {
        activeSocket.close();
      }
    };

    const connectSocket = () => {
      if (!realtimeEnabled || disposed) return;
      if (typeof window.WebSocket !== 'function') {
        startFallbackPolling(!lastPayloadRef.current);
        return;
      }
      if (
        socket
        && (socket.readyState === window.WebSocket.OPEN || socket.readyState === window.WebSocket.CONNECTING)
      ) {
        return;
      }

      try {
        const nextSocket = new window.WebSocket(resolveSceneRealtimeClientUrl(window.location));
        socket = nextSocket;

        nextSocket.onopen = () => {
          if (disposed || socket !== nextSocket) return;
          reconnectAttempts = 0;
          stopFallbackPolling();
        };

        nextSocket.onmessage = (event) => {
          if (disposed || socket !== nextSocket) return;

          try {
            const message = JSON.parse(String(event.data)) as ScenePresenceSocketMessage;
            if (message.type === 'scene:snapshot') {
              stopFallbackPolling();
              syncMembers(message.payload, { correctionMode: 'intent' });
              return;
            }

            if (message.type === 'scene:error' && message.retryable) {
              startFallbackPolling(false);
            }
          } catch {
            // Ignore malformed realtime messages and wait for the next snapshot.
          }
        };

        nextSocket.onerror = () => {
          if (
            nextSocket.readyState === window.WebSocket.OPEN
            || nextSocket.readyState === window.WebSocket.CONNECTING
          ) {
            nextSocket.close();
          }
        };

        nextSocket.onclose = () => {
          if (socket === nextSocket) {
            socket = null;
          }
          if (disposed) return;
          startFallbackPolling(false);
          scheduleReconnect();
        };
      } catch {
        startFallbackPolling(!lastPayloadRef.current);
        scheduleReconnect();
      }
    };

    const syncVisibility = () => {
      const isVisible = document.visibilityState !== 'hidden';
      const wasVisible = visibilityRef.current;
      visibilityRef.current = isVisible;

      if (!isVisible) return;

      if (realtimeEnabled) {
        clearReconnectTimeout();
        connectSocket();
        if (!wasVisible && (!socket || socket.readyState !== window.WebSocket.OPEN)) {
          startFallbackPolling(false);
          void fetchPresence({ clearOnFailure: false });
        }
        return;
      }

      if (!wasVisible) {
        void fetchPresence();
      }
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    const onFocus = () => {
      visibilityRef.current = true;
      if (realtimeEnabled) {
        clearReconnectTimeout();
        connectSocket();
        if (!socket || socket.readyState !== window.WebSocket.OPEN) {
          startFallbackPolling(false);
          void fetchPresence({ clearOnFailure: false });
        }
        return;
      }
      void fetchPresence();
    };

    window.addEventListener('focus', onFocus);

    if (realtimeEnabled) {
      connectSocket();
      if (!initialPayload) {
        startFallbackPolling(true);
      }
    } else {
      if (!initialPayload) {
        initialFetchTimeout = window.setTimeout(() => {
          initialFetchTimeout = 0;
          void fetchPresence();
        }, 0);
      }

      pollId = window.setInterval(() => {
        void fetchPresence();
      }, POLL_MS);
    }

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('focus', onFocus);
      clearReconnectTimeout();
      stopFallbackPolling();
      closeSocket();
    };
  }, [fetchPresence, initialPayload, realtimeEnabled, sceneLabEnabled, sceneLabPreviewMode, syncMembers]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncMembers(sceneLabEnabled ? sceneLabActivePayload : initialPayload);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialPayload, sceneLabActivePayload, sceneLabEnabled, syncMembers]);

  useEffect(() => {
    if (!sceneLabEnabled) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      entitiesRef.current.clear();
      wrapRefs.current.clear();
      visualRefs.current.clear();
      memberKeysStateRef.current = [];
      renderMembersStateRef.current = [];
      setMemberKeys([]);
      setRenderMembers([]);
      lastTimestampRef.current = 0;
      syncMembers(sceneLabActivePayload);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [sceneLabActivePayload, sceneLabEnabled, sceneLabResetSerial, syncMembers]);

  useEffect(() => {
    const onResize = () => syncMembers(sceneLabEnabled ? sceneLabActivePayload : lastPayloadRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sceneLabActivePayload, sceneLabEnabled, syncMembers]);

  useEffect(() => {
    const entities = entitiesRef.current;
    let nextExpiry = Number.POSITIVE_INFINITY;

    for (const key of memberKeys) {
      const entity = entities.get(key);
      if (!entity || entity.removing || entity.activeUntilTs <= 0) continue;
      nextExpiry = Math.min(nextExpiry, entity.activeUntilTs);
    }

    if (!Number.isFinite(nextExpiry)) return undefined;

    const timeoutId = window.setTimeout(() => {
      setRenderNow(Date.now());
    }, Math.max(0, nextExpiry - Date.now()) + 24);

    return () => window.clearTimeout(timeoutId);
  }, [memberKeys, renderNow]);

  useEffect(() => {
    const entities = entitiesRef.current;
    const layers = layerRefs.current;
    const wraps = wrapRefs.current;
    const visuals = visualRefs.current;

    const loop = (timestamp: number) => {
      if (visibilityRef.current === false) {
        lastTimestampRef.current = 0;
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      let dtMs = lastTimestampRef.current > 0 ? Math.min(timestamp - lastTimestampRef.current, 100) : 16;
      if (sceneLabEnabled && !sceneLabPlaying) {
        if (sceneLabStepFramesRef.current > 0) {
          dtMs = 16;
          sceneLabStepFramesRef.current -= 1;
        } else {
          dtMs = 0;
        }
      }
      lastTimestampRef.current = timestamp;

      const size = stageSize();
      const profile = resolveGhostlingSceneProfile(
        size.width,
        variant,
        densityCaps,
        sceneLabEnabled ? sceneLabTuningDraft : runtimeTuningSpec,
        sceneWorldSpec,
        variant === 'hero' ? heroViewportBucket : undefined,
      );
      if (heroPanEnabled) {
        const clampedTarget = createGhostlingSceneCameraMetrics(
          sceneWorldSpec,
          size.width,
          size.height,
          profile.bucket,
          cameraLayoutForVariant(variant),
          { panXWorld: heroPanTargetXWorldRef.current },
        ).panXWorld;
        heroPanTargetXWorldRef.current = clampedTarget;

        if (heroPanDraggingRef.current) {
          heroPanCurrentXWorldRef.current = clampedTarget;
        } else {
          const easingFactor = dtMs > 0
            ? 1 - Math.exp(-dtMs / HERO_PAN_SMOOTHING_MS)
            : 1;
          const nextCurrentPan = blend(
            heroPanCurrentXWorldRef.current,
            clampedTarget,
            easingFactor,
          );
          heroPanCurrentXWorldRef.current = Math.abs(clampedTarget - nextCurrentPan) <= HERO_PAN_SETTLE_EPSILON
            ? clampedTarget
            : nextCurrentPan;
        }
      }

      const metrics = createGhostlingSceneCameraMetrics(
        sceneWorldSpec,
        size.width,
        size.height,
        profile.bucket,
        cameraLayoutForVariant(variant),
        heroPanEnabled ? { panXWorld: heroPanCurrentXWorldRef.current } : undefined,
      );
      if (heroPanEnabled) {
        heroPanCurrentXWorldRef.current = metrics.panXWorld;
        if (Math.abs(heroPanTargetXWorldRef.current - heroPanCurrentXWorldRef.current) <= HERO_PAN_SETTLE_EPSILON) {
          heroPanTargetXWorldRef.current = heroPanCurrentXWorldRef.current;
        }
        const nextCanRecenter = Math.abs(heroPanCurrentXWorldRef.current) > HERO_RECENTER_VISIBILITY_THRESHOLD;
        if (nextCanRecenter !== heroPanCanRecenterRef.current) {
          heroPanCanRecenterRef.current = nextCanRecenter;
          setHeroPanCanRecenter(nextCanRecenter);
        }
      }

      for (const layer of sceneWorldSpec.layers) {
        const layerEl = layers.get(layer.key) ?? null;
        if (!layerEl) continue;
        const parallaxFactor = heroPanEnabled ? heroLayerParallaxFactor(layer.key) : 1;
        const parallaxOffsetX = heroPanEnabled
          ? metrics.panXWorld * metrics.scaleX * (1 - parallaxFactor)
          : 0;
        layerEl.style.width = `${metrics.renderWidth}px`;
        layerEl.style.height = `${metrics.renderHeight}px`;
        layerEl.style.transform = `translate3d(${(metrics.offsetX + parallaxOffsetX).toFixed(2)}px, ${metrics.offsetY.toFixed(2)}px, 0)`;
      }

      const removals: string[] = [];
      const nowTs = Date.now();
      const peerPositions = authoritativeHeroMode
        ? []
        : Array.from(entities.values())
            .filter((entity) => !entity.removing)
            .map((member) => ({
              key: member.key,
              x: member.x,
              y: member.y,
              targetX: member.targetX,
              targetY: member.targetY,
              pointKey: member.pointKey,
              scaleTier: member.scaleTier,
              renderScale: member.renderScale,
              actorMetrics: member.actorMetrics,
            }));

      for (const entity of entities.values()) {
        if (authoritativeHeroMode) {
          entity.heroSamples = entity.heroSamples.filter((sample) => (
            nowTs - sample.sampleAt <= HERO_SAMPLE_MAX_AGE_MS
          ));
          const sampled = sampleHeroPresentation(
            entity.heroSamples,
            nowTs - HERO_INTERPOLATION_DELAY_MS,
          ) ?? latestHeroSample(entity.heroSamples);
          if (sampled) {
            entity.displayX = sampled.x;
            entity.displayY = sampled.y;
            entity.displayRenderScale = sampled.renderScale;
            entity.displayOpacity = sampled.opacity;
            if (
              sampled.movementPhase === 'travel'
              && Math.abs(sampled.velocityX) >= HERO_FACING_VELOCITY_THRESHOLD
            ) {
              entity.displayFacingLeft = sampled.velocityX < 0;
            }
          } else {
            entity.displayX = entity.x;
            entity.displayY = entity.y;
            entity.displayRenderScale = entity.renderScale;
            entity.displayOpacity = entity.opacity;
          }
        } else if (dtMs > 0) {
          const next = advanceGhostlingSceneEntity(entity, {
            dtMs,
            world: sceneWorldSpec,
            profile,
            peers: peerPositions,
            removing: entity.removing,
            reducedMotion: prefersReducedMotion,
            fallback: entity.fallback,
            source: entity.source,
          });
          Object.assign(entity, next);
          entity.displayX = entity.x;
          entity.displayY = entity.y;
          entity.displayRenderScale = entity.renderScale;
          entity.displayFacingLeft = entity.facingLeft;
          entity.displayOpacity = entity.opacity;
        } else {
          entity.displayX = entity.x;
          entity.displayY = entity.y;
          entity.displayRenderScale = entity.renderScale;
          entity.displayFacingLeft = entity.facingLeft;
          entity.displayOpacity = entity.opacity;
        }

        const wrapEl = wraps.get(entity.key) ?? null;
        const visualEl = visuals.get(entity.key) ?? null;
        const state = sceneStateForEntity(entity, hoveredKeyRef.current, nowTs, liveCountRef.current > 0);
        const presenceActive = isScenePresenceActive(entity, sceneLabEnabled);
        const presenceOpacity = scenePresenceVisualOpacity({
          active: presenceActive,
          hovered: state === 'hovered',
        });
        const presenceTone = scenePresenceVisualTone({
          active: presenceActive,
          hovered: state === 'hovered',
        });
        const displayX = authoritativeHeroMode ? entity.displayX : entity.x;
        const displayY = authoritativeHeroMode ? entity.displayY : entity.y;
        const displayRenderScale = authoritativeHeroMode ? entity.displayRenderScale : entity.renderScale;
        const displayFacingLeft = authoritativeHeroMode ? entity.displayFacingLeft : entity.facingLeft;
        const displayOpacity = authoritativeHeroMode ? entity.displayOpacity : entity.opacity;
        const exactGhostSize = resolveGhostlingSceneDisplaySize(displayRenderScale, metrics.scale);
        const metricsForStage = stageRenderMetrics(exactGhostSize, entity.companion?.renderManifest);
        const desiredGhostSize = metricsForStage.desiredSize;
        const actorMetrics = resolveGhostlingActorMetricsFromCompanion(entity.companion);
        const visibleExtents = scaledGhostlingVisibleExtents(displayRenderScale * metrics.scale, actorMetrics);
        const visibleBounds = scaledGhostlingVisibleBounds(displayRenderScale * metrics.scale, actorMetrics);
        const projectedPosition = projectGhostlingWorldPoint(metrics, displayX, displayY);
        const wrapLeft = projectedPosition.x - visibleExtents.left;
        const wrapTop = projectedPosition.y - visibleExtents.top;
        const labelNudge = resolveGhostlingLabelClampOffset(metrics, {
          wrapperTopPx: wrapTop,
        });
        const zBoost = state === 'hovered' ? 180 : state === 'live-active' ? 90 : state === 'featured-mascot' ? 60 : 0;
        const depthBoost = Math.round((displayRenderScale - 2) * 48);

        if (wrapEl) {
          wrapEl.style.opacity = displayOpacity.toFixed(3);
          wrapEl.style.transform = `translate3d(${wrapLeft.toFixed(2)}px, ${wrapTop.toFixed(2)}px, 0)`;
          wrapEl.style.zIndex = String(Math.round((projectedPosition.y * 10) + depthBoost + zBoost));
          wrapEl.style.setProperty('--ghost-size', `${desiredGhostSize}px`);
          wrapEl.style.setProperty('--ghost-label-nudge', `${labelNudge.toFixed(2)}px`);
          wrapEl.style.setProperty('--ghost-label-anchor-x', `${visibleExtents.left.toFixed(2)}px`);
          wrapEl.style.setProperty('--ghost-presence-opacity', presenceOpacity.toFixed(2));
          wrapEl.style.setProperty('--ghost-presence-grayscale', String(presenceTone.grayscale));
          wrapEl.style.setProperty('--ghost-presence-saturate', String(presenceTone.saturate));
          wrapEl.style.setProperty('--ghost-presence-brightness', String(presenceTone.brightness));
          wrapEl.style.width = `${visibleExtents.width}px`;
          wrapEl.style.height = `${visibleExtents.height}px`;
          wrapEl.dataset.sceneState = state;
          wrapEl.dataset.presenceActive = presenceActive ? 'true' : 'false';
          wrapEl.dataset.source = entity.source;
          wrapEl.dataset.zone = entity.safeZoneKey;
          wrapEl.dataset.scaleTier = String(entity.scaleTier);
        }

        if (visualEl) {
          const emphasisScale = state === 'hovered'
            ? 1.08
            : state === 'featured-mascot'
              ? 1.05
              : state === 'live-active'
                ? 1.03
                : 1;
          const facingScale = displayFacingLeft ? 1 : -1;
          visualEl.style.left = `${(-visibleBounds.x).toFixed(2)}px`;
          visualEl.style.top = `${(-visibleBounds.y).toFixed(2)}px`;
          visualEl.style.transform = `scale(${(metricsForStage.residualScale * emphasisScale * facingScale).toFixed(4)}, ${(metricsForStage.residualScale * emphasisScale).toFixed(4)})`;
        }

        if (entity.removing && entity.opacity <= 0) {
          removals.push(entity.key);
        }
      }

      if (removals.length > 0) {
        for (const key of removals) {
          entities.delete(key);
          wraps.delete(key);
          visuals.delete(key);
        }
        commitMemberKeys(Array.from(entities.keys()));
        commitRenderMembers(snapshotRenderMembers(), motionDebugEnabled);
      }

      if (motionDebugEnabled) {
        commitRenderMembers(snapshotRenderMembers(), true);
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [
    commitMemberKeys,
    commitRenderMembers,
    densityCaps,
    prefersReducedMotion,
    authoritativeHeroMode,
    heroPanEnabled,
    heroViewportBucket,
    sceneLabEnabled,
    sceneLabPlaying,
    sceneLabTuningDraft,
    runtimeTuningSpec,
    snapshotRenderMembers,
    stageSize,
    variant,
    motionDebugEnabled,
    sceneWorldSpec,
  ]);

  const renderedMembers = renderMembers.map((entity) => {
    const state = sceneStateForRenderEntity(entity, hoveredKey, renderNow, hasLiveMembers);
    const presenceActive = isScenePresenceActive(entity, sceneLabEnabled);
    return {
      entity,
      state,
      presenceActive,
      presenceOpacity: scenePresenceVisualOpacity({
        active: presenceActive,
        hovered: state === 'hovered',
      }),
      presenceTone: scenePresenceVisualTone({
        active: presenceActive,
        hovered: state === 'hovered',
      }),
    };
  });
  const metrics = renderMetrics;
  const sceneLabMemberDiagnostics: GhostlingSceneLabMemberDiagnostic[] = sceneLabEnabled
    ? renderMembers
        .filter((entity) => !entity.removing)
        .map((entity) => {
          let nearestPeer = Number.POSITIVE_INFINITY;
          for (const peer of renderMembers) {
            if (peer.key === entity.key || peer.removing) continue;
            nearestPeer = Math.min(nearestPeer, Math.hypot(entity.x - peer.x, entity.y - peer.y));
          }
          return {
            key: entity.key,
            displayName: entity.displayName,
            x: entity.x,
            y: entity.y,
            targetX: entity.targetX,
            targetY: entity.targetY,
            pointKey: entity.pointKey,
            safeZoneKey: entity.safeZoneKey,
            movementPhase: entity.movementPhase,
            speed: entity.speed,
            velocityX: entity.velocityX,
            velocityY: entity.velocityY,
            crowding: Number.isFinite(nearestPeer) ? Math.max(0, (metrics.bucket === 'mobile' ? 36 : metrics.bucket === 'tablet' ? 40 : 44) - nearestPeer) : 0,
            distanceToTarget: Math.hypot(entity.targetX - entity.x, entity.targetY - entity.y),
          };
        })
    : [];

  return (
    <section
      className={styles.sceneSection}
      data-variant={variant}
      data-world={world}
      data-preset={preset}
      data-scene-lab={sceneLabEnabled ? 'true' : 'false'}
      aria-label={variant === 'hero' ? 'Ghosted live group canvas' : 'Ghostlings gathering live on Ghosted'}
    >
      {variant === 'section' ? (
        <div className={styles.sceneHeader}>
          <span className={styles.sceneLabel}>In the halls</span>
          <span className={styles.sceneSubtle}>{liveBadgeLabel(payloadSource, liveCount)}</span>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className={`${styles.sceneStage}${prefersReducedMotion ? ` ${styles.staticGrid}` : ''}`}
        data-variant={variant}
        data-world={world}
        data-preset={preset}
        data-live={hasLiveMembers ? 'true' : 'false'}
        data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
        data-scene-lab={sceneLabEnabled ? 'true' : 'false'}
        data-pan-enabled={heroPanEnabled ? 'true' : 'false'}
        data-pan-dragging={heroPanDragging ? 'true' : 'false'}
        data-pan-offset={heroPanCanRecenter ? 'true' : 'false'}
        data-hero-crop-aspect={heroStageAspectRatio ?? undefined}
        style={heroStageAspectRatio
          ? { aspectRatio: heroStageAspectRatio }
          : undefined}
        onPointerDown={onHeroStagePointerDown}
        onPointerMove={onHeroStagePointerMove}
        onPointerUp={onHeroStagePointerUp}
        onPointerCancel={onHeroStagePointerCancel}
        onLostPointerCapture={onHeroStagePointerCancel}
        onDoubleClick={onHeroStageDoubleClick}
      >
        {sceneWorldSpec.layers.map((layer) => (
          (() => {
            const parallaxFactor = heroPanEnabled ? heroLayerParallaxFactor(layer.key) : 1;
            const parallaxOffsetX = heroPanEnabled
              ? metrics.panXWorld * metrics.scaleX * (1 - parallaxFactor)
              : 0;
            return (
              <img
                key={layer.key}
                ref={(node) => {
                  if (node) {
                    layerRefs.current.set(layer.key, node);
                  } else {
                    layerRefs.current.delete(layer.key);
                  }
                }}
                src={layer.src}
                alt=""
                aria-hidden="true"
                className={styles.sceneLayer}
                data-layer={layer.key}
                style={{
                  zIndex: layer.zIndex,
                  width: `${metrics.renderWidth}px`,
                  height: `${metrics.renderHeight}px`,
                  transform: `translate3d(${(metrics.offsetX + parallaxOffsetX).toFixed(2)}px, ${metrics.offsetY.toFixed(2)}px, 0)`,
                }}
              />
            );
          })()
        ))}

        {overlay ? (
          <div className={styles.sceneOverlay}>
            {overlay}
          </div>
        ) : null}

        {heroPanEnabled && heroPanMobileUi && heroPanCanRecenter ? (
          <button
            type="button"
            className={styles.heroPanRecenter}
            aria-label="Recenter scene"
            onClick={triggerHeroPanRecenter}
          >
            Center
          </button>
        ) : null}

        <div
          ref={containerRef}
          className={styles.sceneField}
          role="img"
          aria-label="Ghostlings representing live members and recent clan activity"
        >
          {renderedMembers.map(({ entity, state, presenceActive, presenceOpacity, presenceTone }) => {
            const isInteractive = !entity.fallback;
            const exactGhostSize = resolveGhostlingSceneDisplaySize(entity.renderScale, metrics.scale);
            const stageMetrics = stageRenderMetrics(exactGhostSize, entity.companion?.renderManifest);
            const desiredGhostSize = stageMetrics.desiredSize;
            const actorMetrics = resolveGhostlingActorMetricsFromCompanion(entity.companion);
            const visibleExtents = scaledGhostlingVisibleExtents(entity.renderScale * metrics.scale, actorMetrics);
            const visibleBounds = scaledGhostlingVisibleBounds(entity.renderScale * metrics.scale, actorMetrics);
            const projectedPosition = projectGhostlingWorldPoint(metrics, entity.x, entity.y);
            const wrapLeft = projectedPosition.x - visibleExtents.left;
            const wrapTop = projectedPosition.y - visibleExtents.top;
            const labelNudge = resolveGhostlingLabelClampOffset(metrics, {
              wrapperTopPx: wrapTop,
            });
            const ghostlingVisualSrc = entity.companion?.animatedRenderUrl ?? entity.imgSrc;

            return (
              <div
                key={entity.key}
                ref={(node) => { wrapRefs.current.set(entity.key, node); }}
                className={styles.ghostWrap}
                data-scene-state={state}
                data-source={entity.source}
                data-zone={entity.safeZoneKey}
                data-scale-tier={entity.scaleTier}
                data-presence-active={presenceActive ? 'true' : 'false'}
                tabIndex={isInteractive ? 0 : -1}
                style={{
                  ['--ghost-size' as string]: `${desiredGhostSize}px`,
                  ['--ghost-label-nudge' as string]: `${labelNudge}px`,
                  ['--ghost-label-anchor-x' as string]: `${visibleExtents.left}px`,
                  ['--ghost-presence-opacity' as string]: String(presenceOpacity),
                  ['--ghost-presence-grayscale' as string]: String(presenceTone.grayscale),
                  ['--ghost-presence-saturate' as string]: String(presenceTone.saturate),
                  ['--ghost-presence-brightness' as string]: String(presenceTone.brightness),
                  width: `${visibleExtents.width}px`,
                  height: `${visibleExtents.height}px`,
                  opacity: entity.opacity,
                  transform: `translate3d(${wrapLeft.toFixed(2)}px, ${wrapTop.toFixed(2)}px, 0)`,
                }}
                onMouseEnter={() => {
                  if (!isInteractive || heroPanDraggingRef.current) return;
                  setHoveredKey(entity.key);
                }}
                onMouseLeave={() => {
                  if (hoveredKeyRef.current === entity.key) setHoveredKey(null);
                }}
                onFocus={() => {
                  if (!isInteractive || heroPanDraggingRef.current) return;
                  setHoveredKey(entity.key);
                }}
                onBlur={() => {
                  if (hoveredKeyRef.current === entity.key) setHoveredKey(null);
                }}
                onTouchStart={() => {
                  if (!isInteractive || heroPanDraggingRef.current) return;
                  setHoveredKey((current) => (current === entity.key ? null : entity.key));
                }}
                onKeyDown={(event) => {
                  if (!isInteractive || heroPanDraggingRef.current) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setHoveredKey((current) => (current === entity.key ? null : entity.key));
                  }
                  if (event.key === 'Escape' && hoveredKeyRef.current === entity.key) {
                    setHoveredKey(null);
                  }
                }}
              >
                <div className={styles.ghostAura} aria-hidden="true" style={{ pointerEvents: 'none' }} />
                <div
                  ref={(node) => { visualRefs.current.set(entity.key, node); }}
                  className={styles.ghostVisual}
                  style={{
                    width: `${desiredGhostSize}px`,
                    height: `${desiredGhostSize}px`,
                    left: `${-visibleBounds.x}px`,
                    top: `${-visibleBounds.y}px`,
                    transformOrigin: 'center',
                    transform: `scale(${(stageMetrics.residualScale * (entity.facingLeft ? 1 : -1)).toFixed(4)}, ${stageMetrics.residualScale.toFixed(4)})`,
                  }}
                >
                  {entity.companion ? (
                    <AnimatedCompanionStage
                      manifest={entity.companion.renderManifest}
                      fallbackSrc={entity.companion.animatedRenderUrl}
                      alt={`${entity.displayName}'s Ghostling`}
                      targetSize={stageMetrics.targetSize}
                      presentation={presentationForState(state)}
                      seedKey={`scene:${world}:${variant}:${entity.key}`}
                    />
                  ) : (
                    <img
                      src={ghostlingVisualSrc}
                      alt={`${entity.displayName}'s Ghostling`}
                      width={desiredGhostSize}
                      height={desiredGhostSize}
                      className={styles.ghostImg}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>
                <span className={styles.ghostNameplate}>{preferredSceneLabel(entity)}</span>
                <span
                  className={styles.ghostMetadataCard}
                  aria-hidden={state === 'hovered' ? 'false' : 'true'}
                >
                  {interactionMetadata(entity, renderNow).map((line) => (
                    <span key={`${entity.key}:${line}`} className={styles.ghostMetadataLine}>
                      {line}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        {worldDebugOverlayEnabled ? (
          <WorldDebugOverlay
            world={sceneWorldSpec}
            camera={metrics}
            bucket={metrics.bucket}
            members={renderedMembers.map(({ entity }) => entity)}
          />
        ) : null}
        {sceneLabEnabled ? (
          <GhostlingSceneLab
            worldDraft={sceneLabWorldDraft}
            updateWorldDraft={updateSceneLabWorldDraft}
            tuningDraft={sceneLabTuningDraft}
            updateTuningDraft={updateSceneLabTuningDraft}
            selection={sceneLabSelection}
            onSelectionChange={selectSceneLabItem}
            activeTab={sceneLabActiveTab}
            onActiveTabChange={setSceneLabActiveTab}
            searchQuery={sceneLabSearchQuery}
            onSearchQueryChange={setSceneLabSearchQuery}
            canUndo={sceneLabUndoStack.length > 0}
            canRedo={sceneLabRedoStack.length > 0}
            onUndo={undoSceneLabEdit}
            onRedo={redoSceneLabEdit}
            onBeginHistoryCapture={beginSceneLabHistoryCapture}
            onCommitHistoryCapture={commitSceneLabHistoryCapture}
            onCancelHistoryCapture={cancelSceneLabHistoryCapture}
            bucket={metrics.bucket}
            previewMode={sceneLabPreviewMode}
            playing={sceneLabPlaying}
            ghostCount={sceneLabGhostCount}
            ghostCountMax={sceneLabGhostCountMax}
            memberDiagnostics={sceneLabMemberDiagnostics}
            onPreviewModeChange={(mode) => {
              setSceneLabPreviewMode(mode);
              setSceneLabResetSerial((current) => current + 1);
            }}
            onPlayingChange={setSceneLabPlaying}
            onGhostCountChange={(count) => {
              setSceneLabGhostCount(clamp(count, 1, sceneLabGhostCountMax));
              setSceneLabResetSerial((current) => current + 1);
            }}
            onStep={() => {
              sceneLabStepFramesRef.current += 1;
              setSceneLabPlaying(false);
            }}
            onReset={() => {
              setSceneLabResetSerial((current) => current + 1);
            }}
            onRefreshLive={() => {
              void fetchPresence({ clearOnFailure: false });
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
