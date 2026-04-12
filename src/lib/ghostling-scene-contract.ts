import type { GhostlingSceneDensityBucket, GhostlingWorldSpec } from '@/lib/ghostling-world';

export type GhostlingSceneContractVariant = 'hero' | 'section';

export interface GhostlingSceneContract {
  bucket: GhostlingSceneDensityBucket;
  maxVisible: number;
  pointOrder: string[];
  allowedPointKeys: Set<string>;
}

function canonicalHeroPointOrder(world: GhostlingWorldSpec) {
  return world.viewports.desktop.pointOrder.filter((pointKey) => (
    world.points.some((point) => point.key === pointKey)
  ));
}

export function resolveGhostlingSceneContract(
  world: GhostlingWorldSpec,
  bucket: GhostlingSceneDensityBucket,
  variant: GhostlingSceneContractVariant,
  maxVisibleOverride?: number,
): GhostlingSceneContract {
  const viewport = world.viewports[bucket];
  const pointOrder = variant === 'hero'
    ? canonicalHeroPointOrder(world)
    : viewport.pointOrder.filter((pointKey) => world.points.some((point) => point.key === pointKey));
  const defaultMaxVisible = variant === 'hero'
    ? viewport.maxVisible
    : Math.max(1, viewport.maxVisible - 1);

  return {
    bucket,
    maxVisible: maxVisibleOverride ?? defaultMaxVisible,
    pointOrder,
    allowedPointKeys: new Set(pointOrder),
  };
}

export function isGhostlingScenePointAllowed(
  contract: GhostlingSceneContract,
  pointKey: string,
) {
  return contract.allowedPointKeys.has(pointKey);
}
