import { describe, expect, it } from 'vitest';
import { ghostlingWorldById, loadGhostlingWorldSpec, SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

describe('ghostling world sidecar', () => {
  it('loads shared commons from the authored world package', () => {
    expect(ghostlingWorldById('shared-commons')).toBe(SHARED_COMMONS_WORLD);
    expect(SHARED_COMMONS_WORLD.sourceWidth).toBe(3150);
    expect(SHARED_COMMONS_WORLD.sourceHeight).toBe(350);
    expect(SHARED_COMMONS_WORLD.layers).toHaveLength(4);
  });

  it('keeps point, safe-zone, and viewport references valid', () => {
    const safeZoneKeys = new Set(SHARED_COMMONS_WORLD.safeZones.map((safeZone) => safeZone.key));
    const pointKeys = new Set(SHARED_COMMONS_WORLD.points.map((point) => point.key));

    for (const point of SHARED_COMMONS_WORLD.points) {
      expect(safeZoneKeys.has(point.safeZoneKey)).toBe(true);
      for (const adjacentKey of point.adjacent) {
        expect(pointKeys.has(adjacentKey)).toBe(true);
        expect(adjacentKey).not.toBe(point.key);
      }
    }

    for (const viewport of Object.values(SHARED_COMMONS_WORLD.viewports)) {
      for (const pointKey of viewport.pointOrder) {
        expect(pointKeys.has(pointKey)).toBe(true);
      }
    }
  });

  it('keeps authored guides inside the world canvas', () => {
    const {
      sourceWidth,
      sourceHeight,
      guides: {
        safeArea,
        debugFloorBand,
        centerSafe,
        ultrawideBleed,
        labelSafeTop,
      },
    } = SHARED_COMMONS_WORLD;

    expect(safeArea.x).toBeGreaterThanOrEqual(0);
    expect(safeArea.y).toBeGreaterThanOrEqual(0);
    expect(safeArea.x + safeArea.width).toBeLessThanOrEqual(sourceWidth);
    expect(safeArea.y + safeArea.height).toBeLessThanOrEqual(sourceHeight);

    expect(debugFloorBand.x).toBeGreaterThanOrEqual(0);
    expect(debugFloorBand.y).toBeGreaterThanOrEqual(0);
    expect(debugFloorBand.x + debugFloorBand.width).toBeLessThanOrEqual(sourceWidth);
    expect(debugFloorBand.y + debugFloorBand.height).toBeLessThanOrEqual(sourceHeight);

    expect(centerSafe.x).toBeGreaterThanOrEqual(0);
    expect(centerSafe.y).toBeGreaterThanOrEqual(0);
    expect(centerSafe.x + centerSafe.width).toBeLessThanOrEqual(sourceWidth);
    expect(centerSafe.y + centerSafe.height).toBeLessThanOrEqual(sourceHeight);

    expect(ultrawideBleed.x).toBeGreaterThanOrEqual(0);
    expect(ultrawideBleed.y).toBeGreaterThanOrEqual(0);
    expect(ultrawideBleed.x + ultrawideBleed.width).toBeLessThanOrEqual(sourceWidth);
    expect(ultrawideBleed.y + ultrawideBleed.height).toBeLessThanOrEqual(sourceHeight);

    expect(labelSafeTop?.x).toBeGreaterThanOrEqual(0);
    expect(labelSafeTop?.y).toBeGreaterThanOrEqual(0);
    expect((labelSafeTop?.x ?? 0) + (labelSafeTop?.width ?? 0)).toBeLessThanOrEqual(sourceWidth);
    expect((labelSafeTop?.y ?? 0) + (labelSafeTop?.height ?? 0)).toBeLessThanOrEqual(sourceHeight);
  });

  it('normalizes an aseprite-friendly package with anchors into runtime points', () => {
    const loaded = loadGhostlingWorldSpec({
      kind: 'ghostling-world',
      schemaVersion: 1,
      worldId: 'shared-commons',
      preset: 'public-hero',
      canvas: {
        width: 280,
        height: 140,
      },
      layers: [
        { key: 'sky', src: '/worlds/test/sky.png', zIndex: 0 },
      ],
      guides: {
        horizonY: 40,
        floorY: 118,
        safeArea: { x: 14, y: 10, width: 252, height: 120 },
        debugFloorBand: { x: 0, y: 70, width: 280, height: 70 },
        centerSafe: { x: 28, y: 12, width: 224, height: 104 },
        ultrawideBleed: { x: 8, y: 8, width: 264, height: 116 },
        labelSafeTop: { x: 0, y: 0, width: 280, height: 26 },
      },
      fallbackAnchor: {
        key: 'fallback-anchor',
        label: 'Fallback',
        x: 140,
        y: 98,
        safeZoneKey: 'fallback-anchor',
        layer: 'front',
        scaleTier: 3,
        adjacent: [],
      },
      safeZones: [
        {
          key: 'rear',
          label: 'Rear',
          layer: 'rear',
          bounds: { x: 24, y: 44, width: 80, height: 24 },
          roamRadius: 12,
        },
      ],
      anchors: [
        {
          key: 'rear-main',
          label: 'Rear main',
          x: 64,
          y: 56,
          safeZoneKey: 'rear',
          layer: 'rear',
          scaleTier: 2,
          adjacent: [],
        },
      ],
      viewports: {
        desktop: {
          bucket: 'desktop',
          maxVisible: 1,
          pointOrder: ['rear-main'],
        },
        tablet: {
          bucket: 'tablet',
          maxVisible: 1,
          pointOrder: ['rear-main'],
        },
        mobile: {
          bucket: 'mobile',
          maxVisible: 1,
          pointOrder: ['rear-main'],
        },
      },
    });

    expect(loaded.id).toBe('shared-commons');
    expect(loaded.points).toHaveLength(1);
    expect(loaded.points[0]?.key).toBe('rear-main');
    expect(loaded.viewports.desktop.pointOrder).toEqual(['rear-main']);
    expect(loaded.guides.centerSafe.width).toBe(224);
    expect(loaded.guides.ultrawideBleed.width).toBe(264);
  });
});
