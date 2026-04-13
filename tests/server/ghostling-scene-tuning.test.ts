import { describe, expect, it } from 'vitest';
import { resolveGhostlingSceneTuning, createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

describe('ghostling scene tuning', () => {
  it('resolves per-bucket movement settings and canonical point order', () => {
    const tuning = createDefaultGhostlingSceneTuningSpec();
    const resolved = resolveGhostlingSceneTuning(
      SHARED_COMMONS_WORLD,
      'desktop',
      'hero',
      tuning,
    );

    expect(resolved.maxVisible).toBe(10);
    expect(resolved.pointOrder).toEqual(SHARED_COMMONS_WORLD.viewports.desktop.pointOrder);
    expect(resolved.allowedPointKeys.has('floor-mid-left')).toBe(true);
    expect(resolved.jamBreakoutMs).toBe(tuning.shared.jamBreakoutMs);
    expect(resolved.anchorHopChance).toBe(tuning.shared.anchorHopChance);
  });
});
