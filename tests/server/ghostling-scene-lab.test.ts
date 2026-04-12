import { describe, expect, it } from 'vitest';
import {
  cloneGhostlingWorldDraft,
  exportGhostlingSceneLabSession,
  exportGhostlingWorldDraft,
} from '@/lib/ghostling-scene-lab';
import { createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

describe('ghostling scene lab helpers', () => {
  it('clones and exports the world draft in sidecar shape', () => {
    const draft = cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD);
    draft.points[0]!.x += 12;
    const exported = exportGhostlingWorldDraft(draft);

    expect(exported.kind).toBe('ghostling-world');
    expect(exported.canvas.width).toBe(SHARED_COMMONS_WORLD.sourceWidth);
    expect(exported.anchors[0]?.x).toBe(SHARED_COMMONS_WORLD.points[0]!.x + 12);
    expect(exported.layers).toHaveLength(SHARED_COMMONS_WORLD.layers.length);
  });

  it('exports a combined session bundle with world, tuning, and preview state', () => {
    const session = exportGhostlingSceneLabSession(
      cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD),
      createDefaultGhostlingSceneTuningSpec(),
      {
        mode: 'sandbox',
        playing: true,
        ghostCount: 6,
        bucket: 'desktop',
      },
    );

    expect(session.version).toBe(1);
    expect(session.preview.mode).toBe('sandbox');
    expect(session.world.kind).toBe('ghostling-world');
    expect(session.tuning.buckets.desktop.maxVisible).toBe(8);
  });
});
