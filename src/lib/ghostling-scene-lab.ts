import type {
  GhostlingSceneDensityBucket,
  GhostlingWorldLayerTier,
  GhostlingWorldPoint,
  GhostlingWorldRect,
  GhostlingWorldScaleTier,
  GhostlingWorldSafeZone,
  GhostlingWorldSpec,
} from '@/lib/ghostling-world';
import {
  cloneGhostlingSceneTuningSpec,
  type GhostlingSceneTuningSpec,
} from '@/lib/ghostling-scene-tuning';

export type GhostlingSceneLabPreviewMode = 'sandbox' | 'live';
export type GhostlingSceneLabTab = 'authored' | 'members';
export type GhostlingSceneLabSearchQuery = string;
export type GhostlingSceneLabEditorMutationKind = 'world' | 'tuning';
export type GhostlingSceneLabOverlayKey =
  | 'safe-zones'
  | 'guide-rects'
  | 'guide-lines'
  | 'anchors'
  | 'fallback-anchor'
  | 'members';
export type GhostlingSceneLabOverlayVisibility = Record<GhostlingSceneLabOverlayKey, boolean>;

export type GhostlingSceneLabSelection =
  | { kind: 'anchor'; key: string }
  | { kind: 'fallback-anchor' }
  | { kind: 'safe-zone'; key: string }
  | { kind: 'guide'; key: keyof GhostlingWorldSpec['guides'] }
  | { kind: 'member'; key: string };

export interface GhostlingSceneLabPreviewState {
  mode: GhostlingSceneLabPreviewMode;
  playing: boolean;
  ghostCount: number;
  bucket: GhostlingSceneDensityBucket;
}

export interface GhostlingSceneLabSnapshot {
  worldDraft: GhostlingWorldSpec;
  tuningDraft: GhostlingSceneTuningSpec;
}

export const DEFAULT_GHOSTLING_SCENE_LAB_OVERLAY_VISIBILITY: GhostlingSceneLabOverlayVisibility = {
  'safe-zones': true,
  'guide-rects': true,
  'guide-lines': true,
  anchors: true,
  'fallback-anchor': true,
  members: true,
};

export function resolveGhostlingSceneLabHeroCrop(
  world: GhostlingWorldSpec,
): GhostlingWorldRect {
  return world.guides.heroCrop
    ? { ...world.guides.heroCrop }
    : { ...world.guides.centerSafe };
}

type GhostlingWorldPackageExport = {
  kind: 'ghostling-world';
  schemaVersion: 1;
  worldId: GhostlingWorldSpec['id'];
  preset: GhostlingWorldSpec['preset'];
  canvas: {
    width: number;
    height: number;
  };
  layers: GhostlingWorldSpec['layers'];
  guides: GhostlingWorldSpec['guides'];
  fallbackAnchor: GhostlingWorldSpec['fallbackAnchor'];
  safeZones: GhostlingWorldSpec['safeZones'];
  anchors: GhostlingWorldSpec['points'];
  viewports: GhostlingWorldSpec['viewports'];
};

export function cloneGhostlingWorldDraft(world: GhostlingWorldSpec): GhostlingWorldSpec {
  return {
    ...world,
    layers: world.layers.map((layer) => ({ ...layer })),
    guides: {
      ...world.guides,
      safeArea: { ...world.guides.safeArea },
      debugFloorBand: { ...world.guides.debugFloorBand },
      centerSafe: { ...world.guides.centerSafe },
      ultrawideBleed: { ...world.guides.ultrawideBleed },
      heroCrop: world.guides.heroCrop ? { ...world.guides.heroCrop } : undefined,
      labelSafeTop: world.guides.labelSafeTop ? { ...world.guides.labelSafeTop } : undefined,
    },
    safeArea: { ...world.safeArea },
    debugFloorBand: { ...world.debugFloorBand },
    fallbackAnchor: {
      ...world.fallbackAnchor,
      adjacent: [...world.fallbackAnchor.adjacent],
    },
    safeZones: world.safeZones.map((safeZone) => ({
      ...safeZone,
      bounds: { ...safeZone.bounds },
    })),
    points: world.points.map((point) => ({
      ...point,
      adjacent: [...point.adjacent],
    })),
    viewports: {
      desktop: {
        ...world.viewports.desktop,
        pointOrder: [...world.viewports.desktop.pointOrder],
      },
      tablet: {
        ...world.viewports.tablet,
        pointOrder: [...world.viewports.tablet.pointOrder],
      },
      mobile: {
        ...world.viewports.mobile,
        pointOrder: [...world.viewports.mobile.pointOrder],
      },
    },
  };
}

export function exportGhostlingWorldDraft(
  world: GhostlingWorldSpec,
): GhostlingWorldPackageExport {
  const heroCrop = resolveGhostlingSceneLabHeroCrop(world);
  return {
    kind: 'ghostling-world',
    schemaVersion: 1,
    worldId: world.id,
    preset: world.preset,
    canvas: {
      width: world.sourceWidth,
      height: world.sourceHeight,
    },
    layers: world.layers.map((layer) => ({ ...layer })),
    guides: {
      ...world.guides,
      safeArea: { ...world.guides.safeArea },
      debugFloorBand: { ...world.guides.debugFloorBand },
      centerSafe: { ...world.guides.centerSafe },
      ultrawideBleed: { ...world.guides.ultrawideBleed },
      heroCrop,
      labelSafeTop: world.guides.labelSafeTop ? { ...world.guides.labelSafeTop } : undefined,
    },
    fallbackAnchor: {
      ...world.fallbackAnchor,
      adjacent: [...world.fallbackAnchor.adjacent],
    },
    safeZones: world.safeZones.map((safeZone) => ({
      ...safeZone,
      bounds: { ...safeZone.bounds },
    })),
    anchors: world.points.map((point) => ({
      ...point,
      adjacent: [...point.adjacent],
    })),
    viewports: {
      desktop: {
        ...world.viewports.desktop,
        pointOrder: [...world.viewports.desktop.pointOrder],
      },
      tablet: {
        ...world.viewports.tablet,
        pointOrder: [...world.viewports.tablet.pointOrder],
      },
      mobile: {
        ...world.viewports.mobile,
        pointOrder: [...world.viewports.mobile.pointOrder],
      },
    },
  };
}

export function exportGhostlingSceneLabSession(
  world: GhostlingWorldSpec,
  tuning: GhostlingSceneTuningSpec,
  preview: GhostlingSceneLabPreviewState,
) {
  return {
    version: 1,
    world: exportGhostlingWorldDraft(world),
    tuning,
    preview,
  };
}

export function cloneGhostlingSceneLabSnapshot(
  snapshot: GhostlingSceneLabSnapshot,
): GhostlingSceneLabSnapshot {
  return {
    worldDraft: cloneGhostlingWorldDraft(snapshot.worldDraft),
    tuningDraft: cloneGhostlingSceneTuningSpec(snapshot.tuningDraft),
  };
}

export function ghostlingSceneLabSnapshotEquals(
  left: GhostlingSceneLabSnapshot,
  right: GhostlingSceneLabSnapshot,
) {
  return JSON.stringify({
    world: exportGhostlingWorldDraft(left.worldDraft),
    tuning: left.tuningDraft,
  }) === JSON.stringify({
    world: exportGhostlingWorldDraft(right.worldDraft),
    tuning: right.tuningDraft,
  });
}

export function clampGhostlingWorldRect(
  rect: GhostlingWorldRect,
  world: GhostlingWorldSpec,
): GhostlingWorldRect {
  const width = Math.max(1, Math.min(rect.width, world.sourceWidth));
  const height = Math.max(1, Math.min(rect.height, world.sourceHeight));
  return {
    x: Math.max(0, Math.min(world.sourceWidth - width, Math.round(rect.x))),
    y: Math.max(0, Math.min(world.sourceHeight - height, Math.round(rect.y))),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function findGhostlingSafeZone(
  world: GhostlingWorldSpec,
  safeZoneKey: string,
): GhostlingWorldSafeZone | null {
  return world.safeZones.find((safeZone) => safeZone.key === safeZoneKey) ?? null;
}

function sortZonePoints(points: GhostlingWorldPoint[]) {
  return [...points].sort((left, right) => {
    if (left.x !== right.x) return left.x - right.x;
    if (left.y !== right.y) return left.y - right.y;
    return left.key.localeCompare(right.key);
  });
}

function relinkZoneAdjacency(
  points: GhostlingWorldPoint[],
  safeZoneKey: string,
) {
  const zoneKeys = new Set(points.filter((point) => point.safeZoneKey === safeZoneKey).map((point) => point.key));
  const zonePoints = sortZonePoints(points.filter((point) => point.safeZoneKey === safeZoneKey));
  const adjacencyMap = new Map<string, string[]>();

  for (let index = 0; index < zonePoints.length; index += 1) {
    const previous = zonePoints[index - 1];
    const current = zonePoints[index];
    const next = zonePoints[index + 1];
    if (!current) continue;
    adjacencyMap.set(
      current.key,
      [previous?.key, next?.key].filter((value): value is string => Boolean(value)),
    );
  }

  return points.map((point) => {
    if (!zoneKeys.has(point.key)) return point;
    return {
      ...point,
      adjacent: adjacencyMap.get(point.key) ?? [],
    };
  });
}

function nextAnchorSequence(world: GhostlingWorldSpec) {
  let maxSequence = 0;
  for (const point of world.points) {
    const match = /^anchor-(\d+)$/.exec(point.key);
    if (!match) continue;
    maxSequence = Math.max(maxSequence, Number(match[1]));
  }
  return maxSequence + 1;
}

export function addGhostlingWorldAnchor(
  world: GhostlingWorldSpec,
  options: {
    safeZoneKey?: string;
    afterKey?: string | null;
    x?: number;
    y?: number;
    layer?: GhostlingWorldLayerTier;
    scaleTier?: GhostlingWorldScaleTier;
  } = {},
) {
  const sequence = nextAnchorSequence(world);
  const key = `anchor-${sequence}`;
  const label = `Anchor ${sequence}`;
  const safeZone = findGhostlingSafeZone(
    world,
    options.safeZoneKey ?? world.safeZones[0]?.key ?? world.fallbackAnchor.safeZoneKey,
  ) ?? world.safeZones[0];
  if (!safeZone) {
    return {
      world,
      key: '',
    };
  }

  const afterPoint = options.afterKey
    ? world.points.find((point) => point.key === options.afterKey) ?? null
    : null;
  const zonePoints = sortZonePoints(world.points.filter((point) => point.safeZoneKey === safeZone.key));
  const referencePoint = afterPoint && afterPoint.safeZoneKey === safeZone.key
    ? afterPoint
    : zonePoints.at(-1) ?? null;
  const baseX = options.x
    ?? (referencePoint
      ? referencePoint.x + 48
      : safeZone.bounds.x + Math.round(safeZone.bounds.width / 2));
  const baseY = options.y
    ?? (referencePoint
      ? referencePoint.y
      : safeZone.bounds.y + Math.round(safeZone.bounds.height / 2));
  const inset = 8;
  const point: GhostlingWorldPoint = {
    key,
    label,
    x: Math.max(safeZone.bounds.x + inset, Math.min(safeZone.bounds.x + safeZone.bounds.width - inset, Math.round(baseX))),
    y: Math.max(safeZone.bounds.y + inset, Math.min(safeZone.bounds.y + safeZone.bounds.height - inset, Math.round(baseY))),
    safeZoneKey: safeZone.key,
    layer: options.layer
      ?? referencePoint?.layer
      ?? safeZone.layer,
    scaleTier: options.scaleTier
      ?? referencePoint?.scaleTier
      ?? 2,
    adjacent: [],
  };

  const nextPoints = relinkZoneAdjacency(
    [...world.points, point],
    safeZone.key,
  );
  const zonePointKeys = new Set(nextPoints.filter((candidate) => candidate.safeZoneKey === safeZone.key).map((candidate) => candidate.key));

  const insertPointOrder = (pointOrder: string[]) => {
    const filtered = pointOrder.filter((pointKey) => nextPoints.some((candidate) => candidate.key === pointKey));
    if (options.afterKey && filtered.includes(options.afterKey)) {
      const insertIndex = filtered.indexOf(options.afterKey) + 1;
      return [...filtered.slice(0, insertIndex), key, ...filtered.slice(insertIndex)];
    }

    const sameZoneIndices = filtered.reduce<number[]>((indices, pointKey, index) => {
      if (zonePointKeys.has(pointKey)) indices.push(index);
      return indices;
    }, []);
    if (sameZoneIndices.length > 0) {
      const insertIndex = sameZoneIndices[sameZoneIndices.length - 1] + 1;
      return [...filtered.slice(0, insertIndex), key, ...filtered.slice(insertIndex)];
    }

    return [...filtered, key];
  };

  return {
    key,
    world: {
      ...world,
      points: nextPoints,
      viewports: {
        desktop: {
          ...world.viewports.desktop,
          pointOrder: insertPointOrder(world.viewports.desktop.pointOrder),
        },
        tablet: {
          ...world.viewports.tablet,
          pointOrder: insertPointOrder(world.viewports.tablet.pointOrder),
        },
        mobile: {
          ...world.viewports.mobile,
          pointOrder: insertPointOrder(world.viewports.mobile.pointOrder),
        },
      },
    },
  };
}

export function removeGhostlingWorldAnchor(
  world: GhostlingWorldSpec,
  key: string,
) {
  const removedPoint = world.points.find((point) => point.key === key) ?? null;
  if (!removedPoint || world.points.length <= 1) {
    return {
      world,
      nextSelectionKey: null as string | null,
    };
  }

  const remainingPoints = relinkZoneAdjacency(
    world.points.filter((point) => point.key !== key),
    removedPoint.safeZoneKey,
  );
  const zonePoints = sortZonePoints(remainingPoints.filter((point) => point.safeZoneKey === removedPoint.safeZoneKey));
  const nextSelectionKey = zonePoints[0]?.key ?? null;
  const filterPointOrder = (pointOrder: string[]) => pointOrder.filter((pointKey) => pointKey !== key);

  return {
    nextSelectionKey,
    world: {
      ...world,
      points: remainingPoints,
      viewports: {
        desktop: {
          ...world.viewports.desktop,
          pointOrder: filterPointOrder(world.viewports.desktop.pointOrder),
        },
        tablet: {
          ...world.viewports.tablet,
          pointOrder: filterPointOrder(world.viewports.tablet.pointOrder),
        },
        mobile: {
          ...world.viewports.mobile,
          pointOrder: filterPointOrder(world.viewports.mobile.pointOrder),
        },
      },
    },
  };
}
