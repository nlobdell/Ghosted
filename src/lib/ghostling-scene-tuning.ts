import type { GhostlingSceneDensityBucket, GhostlingWorldSpec } from '@/lib/ghostling-world';
import { resolveGhostlingSceneContract, type GhostlingSceneContractVariant } from '@/lib/ghostling-scene-contract';

export interface GhostlingSceneTuningBucketSettings {
  maxVisible: number;
  speedMin: number;
  speedMax: number;
  pauseMinMs: number;
  pauseMaxMs: number;
  arrivalRadius: number;
  settleRadius: number;
  minGap: number;
  facingFlipVelocity: number;
  facingFlipDistance: number;
}

export interface GhostlingSceneTuningSharedSettings {
  jamBreakoutMs: number;
  verticalTravelFactor: number;
  settleDamping: number;
  minTargetTravelRatio: number;
}

export interface GhostlingSceneTuningSpec {
  buckets: Record<GhostlingSceneDensityBucket, GhostlingSceneTuningBucketSettings>;
  shared: GhostlingSceneTuningSharedSettings;
}

export interface GhostlingResolvedSceneTuning
  extends GhostlingSceneTuningBucketSettings,
    GhostlingSceneTuningSharedSettings {
  bucket: GhostlingSceneDensityBucket;
  pointOrder: string[];
  allowedPointKeys: Set<string>;
}

export function createDefaultGhostlingSceneTuningSpec(): GhostlingSceneTuningSpec {
  return {
    buckets: {
      mobile: {
        maxVisible: 4,
        speedMin: 14,
        speedMax: 18,
        pauseMinMs: 320,
        pauseMaxMs: 720,
        arrivalRadius: 18,
        settleRadius: 2.4,
        minGap: 36,
        facingFlipVelocity: 0.75,
        facingFlipDistance: 14,
      },
      tablet: {
        maxVisible: 6,
        speedMin: 17,
        speedMax: 24,
        pauseMinMs: 360,
        pauseMaxMs: 760,
        arrivalRadius: 20,
        settleRadius: 2.8,
        minGap: 40,
        facingFlipVelocity: 0.82,
        facingFlipDistance: 15,
      },
      desktop: {
        maxVisible: 8,
        speedMin: 18,
        speedMax: 26,
        pauseMinMs: 420,
        pauseMaxMs: 880,
        arrivalRadius: 22,
        settleRadius: 3.1,
        minGap: 44,
        facingFlipVelocity: 0.9,
        facingFlipDistance: 16,
      },
    },
    shared: {
      jamBreakoutMs: 1800,
      verticalTravelFactor: 0.72,
      settleDamping: 5.4,
      minTargetTravelRatio: 0.55,
    },
  };
}

export function cloneGhostlingSceneTuningSpec(
  tuning: GhostlingSceneTuningSpec = createDefaultGhostlingSceneTuningSpec(),
): GhostlingSceneTuningSpec {
  return {
    buckets: {
      mobile: { ...tuning.buckets.mobile },
      tablet: { ...tuning.buckets.tablet },
      desktop: { ...tuning.buckets.desktop },
    },
    shared: { ...tuning.shared },
  };
}

export function resolveGhostlingSceneTuning(
  world: GhostlingWorldSpec,
  bucket: GhostlingSceneDensityBucket,
  variant: GhostlingSceneContractVariant,
  tuning: GhostlingSceneTuningSpec = createDefaultGhostlingSceneTuningSpec(),
  maxVisibleOverride?: number,
): GhostlingResolvedSceneTuning {
  const contract = resolveGhostlingSceneContract(
    world,
    bucket,
    variant,
    maxVisibleOverride ?? tuning.buckets[bucket].maxVisible,
  );
  const settings = tuning.buckets[bucket];

  return {
    bucket,
    pointOrder: contract.pointOrder,
    allowedPointKeys: contract.allowedPointKeys,
    maxVisible: contract.maxVisible,
    speedMin: settings.speedMin,
    speedMax: settings.speedMax,
    pauseMinMs: settings.pauseMinMs,
    pauseMaxMs: settings.pauseMaxMs,
    arrivalRadius: settings.arrivalRadius,
    settleRadius: settings.settleRadius,
    minGap: settings.minGap,
    facingFlipVelocity: settings.facingFlipVelocity,
    facingFlipDistance: settings.facingFlipDistance,
    jamBreakoutMs: tuning.shared.jamBreakoutMs,
    verticalTravelFactor: tuning.shared.verticalTravelFactor,
    settleDamping: tuning.shared.settleDamping,
    minTargetTravelRatio: tuning.shared.minTargetTravelRatio,
  };
}
