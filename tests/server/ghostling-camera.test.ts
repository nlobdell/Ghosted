import { describe, expect, it } from 'vitest';
import {
  createGhostlingSceneCameraMetrics,
  projectGhostlingWorldPoint,
  resolveGhostlingLabelClampOffset,
  unprojectGhostlingScreenPoint,
} from '@/lib/ghostling-camera';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';
import { resolveGhostlingSceneProfile } from '@/lib/ghostling-scene';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

describe('ghostling scene camera', () => {
  it('keeps the authored center-safe focus framed across representative widths', () => {
    const centerPoint = {
      x: SHARED_COMMONS_WORLD.guides.centerSafe.x + (SHARED_COMMONS_WORLD.guides.centerSafe.width / 2),
      y: SHARED_COMMONS_WORLD.guides.centerSafe.y + (SHARED_COMMONS_WORLD.guides.centerSafe.height / 2),
    };

    for (const viewport of VIEWPORTS) {
      const profile = resolveGhostlingSceneProfile(viewport.width, 'hero');
      const camera = createGhostlingSceneCameraMetrics(
        SHARED_COMMONS_WORLD,
        viewport.width,
        viewport.height,
        profile.bucket,
        'fixed-crop',
      );
      const projected = projectGhostlingWorldPoint(camera, centerPoint.x, centerPoint.y);
      const centeredRatio = projected.x / viewport.width;

      expect(centeredRatio).toBeGreaterThan(0.4);
      expect(centeredRatio).toBeLessThan(0.6);
    }
  });

  it('keeps a fixed authored scale on hero viewports and only changes the crop', () => {
    const desktopProfile = resolveGhostlingSceneProfile(1440, 'hero');
    const ultrawideProfile = resolveGhostlingSceneProfile(2560, 'hero');
    const desktopCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      1440,
      900,
      desktopProfile.bucket,
      'fixed-crop',
    );
    const ultrawideCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      2560,
      1080,
      ultrawideProfile.bucket,
      'fixed-crop',
    );
    const anchor = SHARED_COMMONS_WORLD.points.find((point) => point.key === 'floor-left-mid');

    if (!anchor) {
      throw new Error('Expected shared commons anchor.');
    }

    expect(desktopCamera.scale).toBe(1);
    expect(ultrawideCamera.scale).toBe(1);
    expect(ultrawideCamera.worldViewport.width).toBeGreaterThan(desktopCamera.worldViewport.width);

    const projected = projectGhostlingWorldPoint(ultrawideCamera, anchor.x, anchor.y);
    const restored = unprojectGhostlingScreenPoint(ultrawideCamera, projected.x, projected.y);

    expect(restored.x).toBeCloseTo(anchor.x, 4);
    expect(restored.y).toBeCloseTo(anchor.y, 4);
  });

  it('clamps labels against the authored top-safe band', () => {
    const profile = resolveGhostlingSceneProfile(1440, 'hero');
    const camera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      1440,
      900,
      profile.bucket,
      'fixed-crop',
    );

    const nudged = resolveGhostlingLabelClampOffset(camera, {
      wrapperTopPx: 24,
    });
    const relaxed = resolveGhostlingLabelClampOffset(camera, {
      wrapperTopPx: (camera.labelSafeTopPx ?? 0) + 80,
    });

    expect(nudged).toBeGreaterThan(0);
    expect(relaxed).toBe(0);
  });
});
