import { describe, expect, it } from 'vitest';
import {
  addGhostlingWorldAnchor,
  cloneGhostlingSceneLabSnapshot,
  cloneGhostlingWorldDraft,
  exportGhostlingSceneLabSession,
  exportGhostlingWorldDraft,
  ghostlingSceneLabSnapshotEquals,
  removeGhostlingWorldAnchor,
} from '@/lib/ghostling-scene-lab';
import { createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

describe('ghostling scene lab helpers', () => {
  it('clones and exports the world draft in sidecar shape', () => {
    const draft = cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD);
    draft.points[0]!.x += 12;
    if (draft.guides.heroCrop) {
      draft.guides.heroCrop.x += 18;
    }
    const exported = exportGhostlingWorldDraft(draft);

    expect(exported.kind).toBe('ghostling-world');
    expect(exported.canvas.width).toBe(SHARED_COMMONS_WORLD.sourceWidth);
    expect(exported.anchors[0]?.x).toBe(SHARED_COMMONS_WORLD.points[0]!.x + 12);
    expect(exported.guides.heroCrop?.x).toBe((SHARED_COMMONS_WORLD.guides.heroCrop?.x ?? 0) + 18);
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
    expect(session.tuning.buckets.desktop.maxVisible).toBe(10);
    expect(session.tuning.shared.anchorHopChance).toBe(0.35);
  });

  it('clones and compares scene lab snapshots without mutating the original drafts', () => {
    const original = {
      worldDraft: cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD),
      tuningDraft: createDefaultGhostlingSceneTuningSpec(),
    };
    const cloned = cloneGhostlingSceneLabSnapshot(original);

    expect(ghostlingSceneLabSnapshotEquals(original, cloned)).toBe(true);

    cloned.worldDraft.points[0]!.x += 8;
    expect(ghostlingSceneLabSnapshotEquals(original, cloned)).toBe(false);
  });

  it('adds a new anchor into the authored point order and zone adjacency', () => {
    const draft = cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD);
    const result = addGhostlingWorldAnchor(draft, {
      safeZoneKey: 'shared-floor',
      afterKey: 'floor-mid-left',
      x: 1553,
      y: 236,
    });

    expect(result.key).toBeTruthy();
    expect(result.world.points.some((point) => point.key === result.key)).toBe(true);
    expect(result.world.viewports.desktop.pointOrder).toContain(result.key);
    expect(
      result.world.viewports.desktop.pointOrder.indexOf(result.key),
    ).toBe(result.world.viewports.desktop.pointOrder.indexOf('floor-mid-left') + 1);

    const insertedPoint = result.world.points.find((point) => point.key === result.key);
    expect(insertedPoint?.adjacent.length).toBeGreaterThan(0);
  });

  it('removes an authored anchor and reconnects the remaining zone points', () => {
    const draft = cloneGhostlingWorldDraft(SHARED_COMMONS_WORLD);
    const added = addGhostlingWorldAnchor(draft, {
      safeZoneKey: 'shared-floor',
      afterKey: 'floor-mid-left',
      x: 1553,
      y: 236,
    });
    const removed = removeGhostlingWorldAnchor(added.world, added.key);

    expect(removed.world.points.some((point) => point.key === added.key)).toBe(false);
    expect(removed.world.viewports.desktop.pointOrder).not.toContain(added.key);
    expect(
      removed.world.points.every((point) => !point.adjacent.includes(added.key)),
    ).toBe(true);
  });
});
