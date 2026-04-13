import type {
  GhostlingSceneDensityBucket,
  GhostlingWorldRect,
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
