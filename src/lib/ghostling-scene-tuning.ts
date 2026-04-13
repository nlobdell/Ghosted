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
  anchorHopChance: number;
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
        maxVisible: 6,
        speedMin: 14,
        speedMax: 18,
        pauseMinMs: 460,
        pauseMaxMs: 920,
        arrivalRadius: 18,
        settleRadius: 2.4,
        minGap: 36,
        facingFlipVelocity: 0.75,
        facingFlipDistance: 14,
      },
      tablet: {
        maxVisible: 8,
        speedMin: 17,
        speedMax: 24,
        pauseMinMs: 520,
        pauseMaxMs: 1040,
        arrivalRadius: 20,
        settleRadius: 2.8,
        minGap: 40,
        facingFlipVelocity: 0.82,
        facingFlipDistance: 15,
      },
      desktop: {
        maxVisible: 10,
        speedMin: 18,
        speedMax: 26,
        pauseMinMs: 600,
        pauseMaxMs: 1160,
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
      anchorHopChance: 0.35,
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

function assertFiniteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function assertPositiveNumber(value: unknown, label: string) {
  const parsed = assertFiniteNumber(value, label);
  if (parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return parsed;
}

function assertPositiveInteger(value: unknown, label: string) {
  const parsed = assertPositiveNumber(value, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  return parsed;
}

export function loadGhostlingSceneTuningSpec(value: unknown): GhostlingSceneTuningSpec {
  const tuning = value as Partial<GhostlingSceneTuningSpec> | null | undefined;
  const buckets = tuning?.buckets;
  const shared = tuning?.shared;
  if (!buckets || !shared) {
    throw new Error('Ghostling scene tuning must include buckets and shared settings.');
  }

  return {
    buckets: {
      mobile: {
        maxVisible: assertPositiveInteger(buckets.mobile?.maxVisible, 'mobile maxVisible'),
        speedMin: assertPositiveNumber(buckets.mobile?.speedMin, 'mobile speedMin'),
        speedMax: assertPositiveNumber(buckets.mobile?.speedMax, 'mobile speedMax'),
        pauseMinMs: assertPositiveNumber(buckets.mobile?.pauseMinMs, 'mobile pauseMinMs'),
        pauseMaxMs: assertPositiveNumber(buckets.mobile?.pauseMaxMs, 'mobile pauseMaxMs'),
        arrivalRadius: assertPositiveNumber(buckets.mobile?.arrivalRadius, 'mobile arrivalRadius'),
        settleRadius: assertPositiveNumber(buckets.mobile?.settleRadius, 'mobile settleRadius'),
        minGap: assertPositiveNumber(buckets.mobile?.minGap, 'mobile minGap'),
        facingFlipVelocity: assertPositiveNumber(buckets.mobile?.facingFlipVelocity, 'mobile facingFlipVelocity'),
        facingFlipDistance: assertPositiveNumber(buckets.mobile?.facingFlipDistance, 'mobile facingFlipDistance'),
      },
      tablet: {
        maxVisible: assertPositiveInteger(buckets.tablet?.maxVisible, 'tablet maxVisible'),
        speedMin: assertPositiveNumber(buckets.tablet?.speedMin, 'tablet speedMin'),
        speedMax: assertPositiveNumber(buckets.tablet?.speedMax, 'tablet speedMax'),
        pauseMinMs: assertPositiveNumber(buckets.tablet?.pauseMinMs, 'tablet pauseMinMs'),
        pauseMaxMs: assertPositiveNumber(buckets.tablet?.pauseMaxMs, 'tablet pauseMaxMs'),
        arrivalRadius: assertPositiveNumber(buckets.tablet?.arrivalRadius, 'tablet arrivalRadius'),
        settleRadius: assertPositiveNumber(buckets.tablet?.settleRadius, 'tablet settleRadius'),
        minGap: assertPositiveNumber(buckets.tablet?.minGap, 'tablet minGap'),
        facingFlipVelocity: assertPositiveNumber(buckets.tablet?.facingFlipVelocity, 'tablet facingFlipVelocity'),
        facingFlipDistance: assertPositiveNumber(buckets.tablet?.facingFlipDistance, 'tablet facingFlipDistance'),
      },
      desktop: {
        maxVisible: assertPositiveInteger(buckets.desktop?.maxVisible, 'desktop maxVisible'),
        speedMin: assertPositiveNumber(buckets.desktop?.speedMin, 'desktop speedMin'),
        speedMax: assertPositiveNumber(buckets.desktop?.speedMax, 'desktop speedMax'),
        pauseMinMs: assertPositiveNumber(buckets.desktop?.pauseMinMs, 'desktop pauseMinMs'),
        pauseMaxMs: assertPositiveNumber(buckets.desktop?.pauseMaxMs, 'desktop pauseMaxMs'),
        arrivalRadius: assertPositiveNumber(buckets.desktop?.arrivalRadius, 'desktop arrivalRadius'),
        settleRadius: assertPositiveNumber(buckets.desktop?.settleRadius, 'desktop settleRadius'),
        minGap: assertPositiveNumber(buckets.desktop?.minGap, 'desktop minGap'),
        facingFlipVelocity: assertPositiveNumber(buckets.desktop?.facingFlipVelocity, 'desktop facingFlipVelocity'),
        facingFlipDistance: assertPositiveNumber(buckets.desktop?.facingFlipDistance, 'desktop facingFlipDistance'),
      },
    },
    shared: {
      jamBreakoutMs: assertPositiveNumber(shared.jamBreakoutMs, 'shared jamBreakoutMs'),
      verticalTravelFactor: assertPositiveNumber(shared.verticalTravelFactor, 'shared verticalTravelFactor'),
      settleDamping: assertPositiveNumber(shared.settleDamping, 'shared settleDamping'),
      minTargetTravelRatio: assertPositiveNumber(shared.minTargetTravelRatio, 'shared minTargetTravelRatio'),
      anchorHopChance: assertFiniteNumber(shared.anchorHopChance, 'shared anchorHopChance'),
    },
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
    anchorHopChance: tuning.shared.anchorHopChance,
  };
}
