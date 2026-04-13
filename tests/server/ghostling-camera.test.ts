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
  { width: 1280, height: 256 },
  { width: 1440, height: 288 },
  { width: 1920, height: 350 },
  { width: 2560, height: 350 },
  { width: 3840, height: 350 },
];

describe('ghostling scene camera', () => {
  it('keeps the authored hero crop framed across representative hero stage sizes', () => {
    const heroCrop = SHARED_COMMONS_WORLD.guides.heroCrop;

    if (!heroCrop) {
      throw new Error('Expected shared commons hero crop.');
    }

    const centerPoint = {
      x: heroCrop.x + (heroCrop.width / 2),
      y: heroCrop.y + (heroCrop.height / 2),
    };
    const cropBottomPoint = {
      x: heroCrop.x + (heroCrop.width / 2),
      y: heroCrop.y + heroCrop.height,
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
      const projectedCenter = projectGhostlingWorldPoint(camera, centerPoint.x, centerPoint.y);
      const projectedBottom = projectGhostlingWorldPoint(camera, cropBottomPoint.x, cropBottomPoint.y);
      const centeredRatioX = projectedCenter.x / viewport.width;
      const bottomRatioY = projectedBottom.y / viewport.height;

      expect(camera.guideMode).toBe('hero-crop');
      expect(centeredRatioX).toBeGreaterThan(0.4);
      expect(centeredRatioX).toBeLessThan(0.6);
      expect(bottomRatioY).toBeGreaterThan(0.92);
      expect(bottomRatioY).toBeLessThanOrEqual(1.001);
    }
  });

  it('keeps hero crop height fixed while wider stages reveal more horizontal world', () => {
    const heroCrop = SHARED_COMMONS_WORLD.guides.heroCrop;

    if (!heroCrop) {
      throw new Error('Expected shared commons hero crop.');
    }

    const desktopProfile = resolveGhostlingSceneProfile(1440, 'hero');
    const ultrawideProfile = resolveGhostlingSceneProfile(2560, 'hero');
    const desktopCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      1440,
      350,
      desktopProfile.bucket,
      'fixed-crop',
    );
    const ultrawideCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      2560,
      350,
      ultrawideProfile.bucket,
      'fixed-crop',
    );
    const anchor = SHARED_COMMONS_WORLD.points.find((point) => point.key === 'floor-left-mid');

    if (!anchor) {
      throw new Error('Expected shared commons anchor.');
    }

    expect(desktopCamera.scale).toBeCloseTo(350 / heroCrop.height, 4);
    expect(ultrawideCamera.scale).toBeCloseTo(desktopCamera.scale, 4);
    expect(desktopCamera.worldViewport.y).toBeCloseTo(heroCrop.y, 4);
    expect(ultrawideCamera.worldViewport.y).toBeCloseTo(heroCrop.y, 4);
    expect(ultrawideCamera.worldViewport.width).toBeGreaterThan(desktopCamera.worldViewport.width);

    const projected = projectGhostlingWorldPoint(ultrawideCamera, anchor.x, anchor.y);
    const restored = unprojectGhostlingScreenPoint(ultrawideCamera, projected.x, projected.y);

    expect(restored.x).toBeCloseTo(anchor.x, 4);
    expect(restored.y).toBeCloseTo(anchor.y, 4);
  });

  it('uses narrower hero crop widths to increase fixed-crop zoom', () => {
    const heroCrop = SHARED_COMMONS_WORLD.guides.heroCrop;

    if (!heroCrop) {
      throw new Error('Expected shared commons hero crop.');
    }

    const profile = resolveGhostlingSceneProfile(1920, 'hero');
    const baselineCamera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      1920,
      350,
      profile.bucket,
      'fixed-crop',
    );
    const zoomedWorld = {
      ...SHARED_COMMONS_WORLD,
      guides: {
        ...SHARED_COMMONS_WORLD.guides,
        heroCrop: {
          ...heroCrop,
          width: Math.max(420, Math.round(heroCrop.width * 0.18)),
        },
      },
    };
    const zoomedCamera = createGhostlingSceneCameraMetrics(
      zoomedWorld,
      1920,
      350,
      profile.bucket,
      'fixed-crop',
    );

    expect(zoomedCamera.scale).toBeGreaterThan(baselineCamera.scale);
    expect(zoomedCamera.worldViewport.width).toBeLessThan(baselineCamera.worldViewport.width);
    expect(zoomedCamera.guideMode).toBe('hero-crop');
    expect(zoomedCamera.worldViewport.y + zoomedCamera.worldViewport.height).toBeCloseTo(
      heroCrop.y + heroCrop.height,
      4,
    );
  });

  it('clamps labels against the authored top-safe band', () => {
    const profile = resolveGhostlingSceneProfile(1440, 'hero');
    const camera = createGhostlingSceneCameraMetrics(
      SHARED_COMMONS_WORLD,
      1440,
      288,
      profile.bucket,
      'fixed-crop',
    );

    const nudged = resolveGhostlingLabelClampOffset(camera, {
      wrapperTopPx: 0,
    });
    const relaxed = resolveGhostlingLabelClampOffset(camera, {
      wrapperTopPx: (camera.labelSafeTopPx ?? 0) + 80,
    });

    expect(nudged).toBeGreaterThan(0);
    expect(relaxed).toBe(0);
  });
});
