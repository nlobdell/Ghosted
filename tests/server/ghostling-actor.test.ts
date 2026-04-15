import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GHOSTLING_ACTOR_METRICS,
  resolveGhostlingActorMetrics,
  scaleGhostlingFrameSize,
  scaledGhostlingFeetOffset,
  scaledGhostlingFootprint,
  scaledGhostlingVisibleExtents,
} from '@/lib/ghostling-actor';
import type { CompanionRenderManifest } from '@/lib/types';

describe('ghostling actor metrics', () => {
  it('matches the repo default 70x70 animated ghostling asset bounds', () => {
    expect(DEFAULT_GHOSTLING_ACTOR_METRICS.sourceWidth).toBe(70);
    expect(DEFAULT_GHOSTLING_ACTOR_METRICS.sourceHeight).toBe(70);
    expect(DEFAULT_GHOSTLING_ACTOR_METRICS.visibleBounds).toEqual({
      x: 21,
      y: 20,
      width: 28,
      height: 49,
    });
    expect(DEFAULT_GHOSTLING_ACTOR_METRICS.footprintBounds).toEqual({
      x: 29,
      y: 56,
      width: 15,
      height: 13,
    });
  });

  it('scales frame, visible extents, and footprint from the source grid', () => {
    expect(scaleGhostlingFrameSize(2)).toBe(140);
    expect(scaledGhostlingVisibleExtents(2)).toEqual({
      left: 28,
      right: 28,
      top: 30,
      bottom: 68,
      width: 56,
      height: 98,
    });
    expect(scaledGhostlingFootprint(2)).toEqual({
      width: 30,
      height: 26,
    });
    expect(scaledGhostlingFeetOffset(2)).toEqual({
      x: 0,
      y: 66,
    });
  });

  it('expands visible bounds when cosmetic slices extend beyond the base silhouette', () => {
    const manifest: CompanionRenderManifest = {
      width: 70,
      height: 70,
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: { root: {} },
        slotGroups: {},
        accents: [],
      },
      layers: [{
        key: 'hat-front',
        role: 'hat-front',
        src: '/hat.png',
        zIndex: 50,
        sceneFacingFlip: 'allow',
        slot: 'hat',
        motionGroup: 'head',
        animation: {
          mode: 'static',
          fps: 0,
          frameCount: 1,
          frameWidth: 70,
          frameHeight: 70,
          loop: false,
        },
        slices: [{
          key: 'hat-front',
          sourceX: 0,
          sourceY: 0,
          sourceWidth: 34,
          sourceHeight: 18,
          targetX: 18,
          targetY: 4,
          targetWidth: 34,
          targetHeight: 18,
          motionGroup: 'head',
        }],
      }],
    };

    expect(resolveGhostlingActorMetrics(manifest).visibleBounds).toEqual({
      x: 18,
      y: 4,
      width: 34,
      height: 65,
    });
  });
});
