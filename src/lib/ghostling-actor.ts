import type {
  CompanionActorMetrics,
  CompanionPreviewSummary,
  CompanionRenderManifest,
  CompanionRenderPoint,
  CompanionRenderRect,
} from '@/lib/types';

export type GhostlingActorRect = CompanionRenderRect;

export interface GhostlingActorMetrics extends CompanionActorMetrics {
  centerX: number;
  centerY: number;
  feetAnchorX: number;
  feetAnchorY: number;
}

type GhostlingActorMetricsLike = GhostlingActorMetrics | CompanionActorMetrics;

// Derived from the repo's default 70x70 animated base asset:
// assets/companion/defaults/base/ghostling-base-animated.png
export const DEFAULT_GHOSTLING_ACTOR_METRICS: GhostlingActorMetrics = {
  sourceWidth: 70,
  sourceHeight: 70,
  centerX: 35,
  centerY: 35,
  feetAnchorX: 35,
  feetAnchorY: 68,
  feetAnchor: {
    x: 35,
    y: 68,
  },
  visibleBounds: {
    x: 21,
    y: 13,
    width: 28,
    height: 49,
  },
  footprintBounds: {
    x: 29,
    y: 56,
    width: 15,
    height: 13,
  },
};

const manifestActorMetricsCache = new WeakMap<CompanionRenderManifest, GhostlingActorMetrics>();

function canonicalizeRect(rect: GhostlingActorRect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  } satisfies GhostlingActorRect;
}

function canonicalizePoint(point: CompanionRenderPoint) {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  } satisfies CompanionRenderPoint;
}

function unionActorRects(rects: GhostlingActorRect[]) {
  if (rects.length === 0) return null;

  let minX = rects[0]!.x;
  let minY = rects[0]!.y;
  let maxX = rects[0]!.x + rects[0]!.width;
  let maxY = rects[0]!.y + rects[0]!.height;

  for (const rect of rects.slice(1)) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  } satisfies GhostlingActorRect;
}

function isMeaningfulSliceRect(
  manifest: CompanionRenderManifest,
  rect: GhostlingActorRect,
) {
  return rect.x !== 0
    || rect.y !== 0
    || rect.width !== manifest.width
    || rect.height !== manifest.height;
}

function manifestVisibleBounds(manifest: CompanionRenderManifest) {
  const authoredMetrics = manifest.debug?.actorMetrics;
  if (authoredMetrics) {
    return canonicalizeRect(authoredMetrics.visibleBounds);
  }

  const rects: GhostlingActorRect[] = [DEFAULT_GHOSTLING_ACTOR_METRICS.visibleBounds];

  for (const layer of manifest.layers) {
    for (const slice of layer.slices ?? []) {
      const rect = {
        x: slice.targetX,
        y: slice.targetY,
        width: slice.targetWidth,
        height: slice.targetHeight,
      } satisfies GhostlingActorRect;

      if (!isMeaningfulSliceRect(manifest, rect)) {
        continue;
      }

      rects.push(rect);
    }
  }

  return unionActorRects(rects) ?? DEFAULT_GHOSTLING_ACTOR_METRICS.visibleBounds;
}

function manifestFootprintBounds(manifest: CompanionRenderManifest) {
  const authoredMetrics = manifest.debug?.actorMetrics;
  if (authoredMetrics) {
    return canonicalizeRect(authoredMetrics.footprintBounds);
  }

  return DEFAULT_GHOSTLING_ACTOR_METRICS.footprintBounds;
}

function manifestFeetAnchor(manifest: CompanionRenderManifest) {
  const authoredMetrics = manifest.debug?.actorMetrics;
  if (authoredMetrics) {
    return canonicalizePoint(authoredMetrics.feetAnchor);
  }

  return DEFAULT_GHOSTLING_ACTOR_METRICS.feetAnchor;
}

export function ghostlingActorMetricsFromPrecomputed(
  metrics?: CompanionActorMetrics | null,
): GhostlingActorMetrics | null {
  if (!metrics) return null;

  const sourceWidth = Math.max(1, Math.round(metrics.sourceWidth));
  const sourceHeight = Math.max(1, Math.round(metrics.sourceHeight));
  const feetAnchor = canonicalizePoint(metrics.feetAnchor);
  return {
    sourceWidth,
    sourceHeight,
    centerX: sourceWidth / 2,
    centerY: sourceHeight / 2,
    feetAnchorX: feetAnchor.x,
    feetAnchorY: feetAnchor.y,
    feetAnchor,
    visibleBounds: canonicalizeRect(metrics.visibleBounds),
    footprintBounds: canonicalizeRect(metrics.footprintBounds),
  } satisfies GhostlingActorMetrics;
}

export function resolveGhostlingActorMetrics(
  manifest?: CompanionRenderManifest | null,
  precomputedMetrics?: CompanionActorMetrics | null,
) {
  const precomputed = ghostlingActorMetricsFromPrecomputed(precomputedMetrics);
  if (precomputed) return precomputed;
  if (!manifest) return DEFAULT_GHOSTLING_ACTOR_METRICS;

  const cached = manifestActorMetricsCache.get(manifest);
  if (cached) return cached;

  const feetAnchor = manifestFeetAnchor(manifest);

  const metrics = {
    ...DEFAULT_GHOSTLING_ACTOR_METRICS,
    sourceWidth: manifest.width,
    sourceHeight: manifest.height,
    centerX: manifest.width / 2,
    centerY: manifest.height / 2,
    feetAnchor,
    feetAnchorX: feetAnchor.x,
    feetAnchorY: feetAnchor.y,
    visibleBounds: manifestVisibleBounds(manifest),
    footprintBounds: manifestFootprintBounds(manifest),
  } satisfies GhostlingActorMetrics;

  manifestActorMetricsCache.set(manifest, metrics);
  return metrics;
}

export function resolveGhostlingActorMetricsFromCompanion(
  companion?: CompanionPreviewSummary | null,
) {
  return resolveGhostlingActorMetrics(
    companion?.renderManifest,
    companion?.actorMetrics,
  );
}

export function scaleGhostlingFrameSize(
  scale: number,
  metrics: GhostlingActorMetricsLike = DEFAULT_GHOSTLING_ACTOR_METRICS,
) {
  return resolveGhostlingActorMetrics(undefined, metrics).sourceWidth * scale;
}

export function scaledGhostlingVisibleExtents(
  scale: number,
  metrics: GhostlingActorMetricsLike = DEFAULT_GHOSTLING_ACTOR_METRICS,
) {
  const resolvedMetrics = resolveGhostlingActorMetrics(undefined, metrics);
  const { centerX, centerY, visibleBounds } = resolvedMetrics;
  return {
    left: (centerX - visibleBounds.x) * scale,
    right: ((visibleBounds.x + visibleBounds.width) - centerX) * scale,
    top: (centerY - visibleBounds.y) * scale,
    bottom: ((visibleBounds.y + visibleBounds.height) - centerY) * scale,
    width: visibleBounds.width * scale,
    height: visibleBounds.height * scale,
  };
}

export function scaledGhostlingVisibleBounds(
  scale: number,
  metrics: GhostlingActorMetricsLike = DEFAULT_GHOSTLING_ACTOR_METRICS,
) {
  const { visibleBounds } = resolveGhostlingActorMetrics(undefined, metrics);
  return {
    x: visibleBounds.x * scale,
    y: visibleBounds.y * scale,
    width: visibleBounds.width * scale,
    height: visibleBounds.height * scale,
  };
}

export function scaledGhostlingFootprint(scale: number) {
  const { footprintBounds } = DEFAULT_GHOSTLING_ACTOR_METRICS;
  return scaledGhostlingFootprintForMetrics(scale, {
    footprintBounds,
  } as Pick<GhostlingActorMetrics, 'footprintBounds'>);
}

export function scaledGhostlingFootprintForMetrics(
  scale: number,
  metrics: Pick<CompanionActorMetrics, 'footprintBounds'> = DEFAULT_GHOSTLING_ACTOR_METRICS,
) {
  const { footprintBounds } = metrics;
  return {
    width: footprintBounds.width * scale,
    height: footprintBounds.height * scale,
  };
}

export function scaledGhostlingFeetOffset(
  scale: number,
  metrics: GhostlingActorMetricsLike = DEFAULT_GHOSTLING_ACTOR_METRICS,
) {
  const { centerX, centerY, feetAnchorX, feetAnchorY } = resolveGhostlingActorMetrics(undefined, metrics);
  return {
    x: (feetAnchorX - centerX) * scale,
    y: (feetAnchorY - centerY) * scale,
  };
}
