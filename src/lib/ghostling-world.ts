import sharedCommonsWorldFile from '@/lib/worlds/shared-commons.world.json';

export type GhostlingSceneDensityBucket = 'desktop' | 'tablet' | 'mobile';
export type GhostlingWorldId = 'shared-commons';
export type GhostlingWorldPreset = 'public-hero';
export type GhostlingWorldScaleTier = 2 | 3;
export type GhostlingWorldLayerTier = 'rear' | 'front';

export interface GhostlingWorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GhostlingWorldGuides {
  horizonY: number;
  floorY: number;
  safeArea: GhostlingWorldRect;
  debugFloorBand: GhostlingWorldRect;
  centerSafe: GhostlingWorldRect;
  ultrawideBleed: GhostlingWorldRect;
  heroCrop?: GhostlingWorldRect;
  labelSafeTop?: GhostlingWorldRect;
}

export interface GhostlingWorldLayer {
  key: string;
  src: string;
  zIndex: number;
}

// This mirrors the Ghostling Tools authoring style in Aseprite:
// sidecar data defines explicit anchor-like points plus safe regions.
export interface GhostlingWorldPoint {
  key: string;
  label: string;
  x: number;
  y: number;
  safeZoneKey: string;
  layer: GhostlingWorldLayerTier;
  scaleTier: GhostlingWorldScaleTier;
  adjacent: string[];
}

export interface GhostlingWorldSafeZone {
  key: string;
  label: string;
  layer: GhostlingWorldLayerTier;
  bounds: GhostlingWorldRect;
  roamRadius: number;
}

export interface GhostlingWorldViewport {
  bucket: GhostlingSceneDensityBucket;
  maxVisible: number;
  pointOrder: string[];
}

export interface GhostlingWorldSpec {
  id: GhostlingWorldId;
  preset: GhostlingWorldPreset;
  sourceWidth: number;
  sourceHeight: number;
  layers: GhostlingWorldLayer[];
  guides: GhostlingWorldGuides;
  horizonY: number;
  floorY: number;
  safeArea: GhostlingWorldRect;
  debugFloorBand: GhostlingWorldRect;
  fallbackAnchor: GhostlingWorldPoint;
  safeZones: GhostlingWorldSafeZone[];
  points: GhostlingWorldPoint[];
  viewports: Record<GhostlingSceneDensityBucket, GhostlingWorldViewport>;
}

export type GhostlingWorldLegacyFile = {
  id: GhostlingWorldId;
  preset: GhostlingWorldPreset;
  canvas: {
    width: number;
    height: number;
  };
  layers: GhostlingWorldLayer[];
  guides: GhostlingWorldGuides;
  fallbackAnchor: GhostlingWorldPoint;
  safeZones: GhostlingWorldSafeZone[];
  points: GhostlingWorldPoint[];
  viewports: Record<GhostlingSceneDensityBucket, GhostlingWorldViewport>;
};

export type GhostlingWorldPackageFile = {
  kind: 'ghostling-world';
  schemaVersion: 1;
  worldId: GhostlingWorldId;
  preset: GhostlingWorldPreset;
  canvas: {
    width: number;
    height: number;
  };
  layers: GhostlingWorldLayer[];
  guides: GhostlingWorldGuides;
  fallbackAnchor: GhostlingWorldPoint;
  safeZones: GhostlingWorldSafeZone[];
  anchors: GhostlingWorldPoint[];
  viewports: Record<GhostlingSceneDensityBucket, GhostlingWorldViewport>;
};

function isGhostlingWorldPackageFile(file: GhostlingWorldLegacyFile | GhostlingWorldPackageFile): file is GhostlingWorldPackageFile {
  return 'kind' in file;
}

function assertUniqueKeys(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} "${value}" in Ghostling world sidecar.`);
    }
    seen.add(value);
  }
}

function assertRectInsideCanvas(rect: GhostlingWorldRect, width: number, height: number, label: string) {
  if (rect.x < 0 || rect.y < 0 || rect.width < 0 || rect.height < 0) {
    throw new Error(`Invalid ${label} rectangle in Ghostling world sidecar.`);
  }
  if (rect.x + rect.width > width || rect.y + rect.height > height) {
    throw new Error(`${label} rectangle exceeds the Ghostling world canvas.`);
  }
}

function validateGhostlingWorldSpec(spec: GhostlingWorldSpec) {
  assertUniqueKeys(spec.layers.map((layer) => layer.key), 'world layer key');
  assertUniqueKeys(spec.safeZones.map((safeZone) => safeZone.key), 'safe zone key');
  assertUniqueKeys(spec.points.map((point) => point.key), 'point key');

  assertRectInsideCanvas(spec.guides.safeArea, spec.sourceWidth, spec.sourceHeight, 'safe area');
  assertRectInsideCanvas(spec.guides.debugFloorBand, spec.sourceWidth, spec.sourceHeight, 'debug floor band');
  assertRectInsideCanvas(spec.guides.centerSafe, spec.sourceWidth, spec.sourceHeight, 'center safe guide');
  assertRectInsideCanvas(spec.guides.ultrawideBleed, spec.sourceWidth, spec.sourceHeight, 'ultrawide bleed guide');
  if (spec.guides.heroCrop) {
    assertRectInsideCanvas(spec.guides.heroCrop, spec.sourceWidth, spec.sourceHeight, 'hero crop guide');
  }
  if (spec.guides.labelSafeTop) {
    assertRectInsideCanvas(spec.guides.labelSafeTop, spec.sourceWidth, spec.sourceHeight, 'label safe top guide');
  }

  const safeZoneKeys = new Set(spec.safeZones.map((safeZone) => safeZone.key));
  const pointKeys = new Set(spec.points.map((point) => point.key));

  for (const safeZone of spec.safeZones) {
    assertRectInsideCanvas(safeZone.bounds, spec.sourceWidth, spec.sourceHeight, `safe zone "${safeZone.key}"`);
  }

  for (const point of spec.points) {
    if (!safeZoneKeys.has(point.safeZoneKey)) {
      throw new Error(`Point "${point.key}" references missing safe zone "${point.safeZoneKey}".`);
    }
    if (point.x < 0 || point.x > spec.sourceWidth || point.y < 0 || point.y > spec.sourceHeight) {
      throw new Error(`Point "${point.key}" is outside the Ghostling world canvas.`);
    }
    for (const adjacentKey of point.adjacent) {
      if (!pointKeys.has(adjacentKey)) {
        throw new Error(`Point "${point.key}" references missing adjacent point "${adjacentKey}".`);
      }
      if (adjacentKey === point.key) {
        throw new Error(`Point "${point.key}" cannot reference itself as adjacent.`);
      }
    }
  }

  if (spec.fallbackAnchor.x < 0 || spec.fallbackAnchor.x > spec.sourceWidth || spec.fallbackAnchor.y < 0 || spec.fallbackAnchor.y > spec.sourceHeight) {
    throw new Error('Fallback anchor is outside the Ghostling world canvas.');
  }

  for (const viewport of Object.values(spec.viewports)) {
    for (const pointKey of viewport.pointOrder) {
      if (!pointKeys.has(pointKey)) {
        throw new Error(`Viewport "${viewport.bucket}" references missing point "${pointKey}".`);
      }
    }
  }

  return spec;
}

export function loadGhostlingWorldSpec(
  file: GhostlingWorldLegacyFile | GhostlingWorldPackageFile,
): GhostlingWorldSpec {
  if (isGhostlingWorldPackageFile(file)) {
    if (file.kind !== 'ghostling-world') {
      throw new Error(`Unsupported Ghostling world package kind "${String(file.kind)}".`);
    }
    if (file.schemaVersion !== 1) {
      throw new Error(`Unsupported Ghostling world schema version "${String(file.schemaVersion)}".`);
    }

    return validateGhostlingWorldSpec({
      id: file.worldId,
      preset: file.preset,
      sourceWidth: file.canvas.width,
      sourceHeight: file.canvas.height,
      layers: file.layers,
      guides: file.guides,
      horizonY: file.guides.horizonY,
      floorY: file.guides.floorY,
      safeArea: file.guides.safeArea,
      debugFloorBand: file.guides.debugFloorBand,
      fallbackAnchor: file.fallbackAnchor,
      safeZones: file.safeZones,
      points: file.anchors,
      viewports: file.viewports,
    });
  }

  return validateGhostlingWorldSpec({
    id: file.id,
    preset: file.preset,
    sourceWidth: file.canvas.width,
    sourceHeight: file.canvas.height,
    layers: file.layers,
    guides: file.guides,
    horizonY: file.guides.horizonY,
    floorY: file.guides.floorY,
    safeArea: file.guides.safeArea,
    debugFloorBand: file.guides.debugFloorBand,
    fallbackAnchor: file.fallbackAnchor,
    safeZones: file.safeZones,
    points: file.points,
    viewports: file.viewports,
  });
}

export function ghostlingWorldPackageFromSpec(
  spec: GhostlingWorldSpec,
): GhostlingWorldPackageFile {
  return {
    kind: 'ghostling-world',
    schemaVersion: 1,
    worldId: spec.id,
    preset: spec.preset,
    canvas: {
      width: spec.sourceWidth,
      height: spec.sourceHeight,
    },
    layers: spec.layers.map((layer) => ({ ...layer })),
    guides: {
      ...spec.guides,
      safeArea: { ...spec.guides.safeArea },
      debugFloorBand: { ...spec.guides.debugFloorBand },
      centerSafe: { ...spec.guides.centerSafe },
      ultrawideBleed: { ...spec.guides.ultrawideBleed },
      heroCrop: spec.guides.heroCrop ? { ...spec.guides.heroCrop } : undefined,
      labelSafeTop: spec.guides.labelSafeTop ? { ...spec.guides.labelSafeTop } : undefined,
    },
    fallbackAnchor: {
      ...spec.fallbackAnchor,
      adjacent: [...spec.fallbackAnchor.adjacent],
    },
    safeZones: spec.safeZones.map((safeZone) => ({
      ...safeZone,
      bounds: { ...safeZone.bounds },
    })),
    anchors: spec.points.map((point) => ({
      ...point,
      adjacent: [...point.adjacent],
    })),
    viewports: {
      desktop: {
        ...spec.viewports.desktop,
        pointOrder: [...spec.viewports.desktop.pointOrder],
      },
      tablet: {
        ...spec.viewports.tablet,
        pointOrder: [...spec.viewports.tablet.pointOrder],
      },
      mobile: {
        ...spec.viewports.mobile,
        pointOrder: [...spec.viewports.mobile.pointOrder],
      },
    },
  };
}

export const SHARED_COMMONS_WORLD = loadGhostlingWorldSpec(
  sharedCommonsWorldFile as GhostlingWorldLegacyFile | GhostlingWorldPackageFile,
);

export function ghostlingWorldById(worldId: GhostlingWorldId) {
  if (worldId === 'shared-commons') return SHARED_COMMONS_WORLD;
  return SHARED_COMMONS_WORLD;
}

export function resolveGhostlingSceneBucket(width: number): GhostlingSceneDensityBucket {
  if (width <= 640) return 'mobile';
  if (width <= 960) return 'tablet';
  return 'desktop';
}
