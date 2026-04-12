import { describe, expect, it } from 'vitest';
import { DEFAULT_GHOSTLING_ACTOR_METRICS, scaledGhostlingFootprint } from '@/lib/ghostling-actor';
import {
  advanceGhostlingSceneEntity,
  createGhostlingSceneMotionState,
  preferredGhostlingScenePointKey,
  resolveGhostlingSceneDisplaySize,
  resolveGhostlingSceneProfile,
  type GhostlingScenePeerState,
  type GhostlingSceneMotionState,
} from '@/lib/ghostling-scene';
import { SHARED_COMMONS_WORLD } from '@/lib/ghostling-world';

function pointX(pointKey: string) {
  const point = SHARED_COMMONS_WORLD.points.find((candidate) => candidate.key === pointKey);
  if (!point) {
    throw new Error(`Missing point "${pointKey}" in shared world.`);
  }
  return point.x;
}

function pointY(pointKey: string) {
  const point = SHARED_COMMONS_WORLD.points.find((candidate) => candidate.key === pointKey);
  if (!point) {
    throw new Error(`Missing point "${pointKey}" in shared world.`);
  }
  return point.y;
}

function peerState(
  overrides: Partial<GhostlingScenePeerState> & Pick<
    GhostlingScenePeerState,
    'key' | 'x' | 'y' | 'pointKey' | 'scaleTier' | 'renderScale'
  >,
): GhostlingScenePeerState {
  return {
    actorMetrics: DEFAULT_GHOSTLING_ACTOR_METRICS,
    ...overrides,
  };
}

describe('ghostling scene logic', () => {
  it('uses authored viewport caps for the shared-floor scene per breakpoint', () => {
    const desktopProfile = resolveGhostlingSceneProfile(1200, 'hero');
    const tabletProfile = resolveGhostlingSceneProfile(820, 'hero');
    const mobileProfile = resolveGhostlingSceneProfile(420, 'hero');

    expect(desktopProfile.bucket).toBe('desktop');
    expect(desktopProfile.maxVisible).toBe(8);

    expect(tabletProfile.bucket).toBe('tablet');
    expect(tabletProfile.maxVisible).toBe(6);

    expect(mobileProfile.bucket).toBe('mobile');
    expect(mobileProfile.maxVisible).toBe(4);
    expect(tabletProfile.pointOrder).toEqual(desktopProfile.pointOrder);
    expect(mobileProfile.pointOrder).toEqual(desktopProfile.pointOrder);
    expect(Array.from(tabletProfile.allowedPointKeys)).toEqual(Array.from(desktopProfile.allowedPointKeys));
    expect(Array.from(mobileProfile.allowedPointKeys)).toEqual(Array.from(desktopProfile.allowedPointKeys));
  });

  it('keeps mark assignment deterministic and uses the authored fallback anchor', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');

    expect(preferredGhostlingScenePointKey(profile, 0)).toBe('floor-left-outer');
    expect(preferredGhostlingScenePointKey(profile, 4)).toBe('floor-mid-right');
    expect(preferredGhostlingScenePointKey(profile, 7)).toBe('floor-right-outer');
    expect(preferredGhostlingScenePointKey(profile, 0, true)).toBe(SHARED_COMMONS_WORLD.fallbackAnchor.key);
  });

  it('keeps the canonical hero point order stable across breakpoints', () => {
    const desktopProfile = resolveGhostlingSceneProfile(1200, 'hero');
    const tabletProfile = resolveGhostlingSceneProfile(820, 'hero');
    const mobileProfile = resolveGhostlingSceneProfile(420, 'hero');

    expect(tabletProfile.pointOrder).toEqual(desktopProfile.pointOrder);
    expect(mobileProfile.pointOrder).toEqual(desktopProfile.pointOrder);
  });

  it('creates motion state from shared-floor anchors and a consistent 2x tier', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const left = createGhostlingSceneMotionState(
      'user:left',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    const right = createGhostlingSceneMotionState(
      'user:right',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-right-inner',
    );

    expect(left.safeZoneKey).toBe('shared-floor');
    expect(left.scaleTier).toBe(2);
    expect(right.safeZoneKey).toBe('shared-floor');
    expect(right.scaleTier).toBe(2);
    expect(resolveGhostlingSceneDisplaySize(left.scaleTier, 1)).toBe(140);
    expect(resolveGhostlingSceneDisplaySize(right.scaleTier, 1)).toBe(140);
    expect(Math.abs(left.targetX - pointX('floor-mid-left'))).toBeLessThanOrEqual(42);
    expect(Math.abs(right.targetX - pointX('floor-right-inner'))).toBeLessThanOrEqual(42);
  });

  it('keeps roaming inside authored world bounds while steering away from crowding', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:42',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-left-mid') - 20;
    motion.y = 216;
    motion.targetX = pointX('floor-left-mid') + 40;
    motion.targetY = 214;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 100,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        peerState({ key: 'peer', x: 540, y: 216, pointKey: 'floor-left-inner', scaleTier: 2, renderScale: 2 }),
      ],
    });

    expect(next.x).toBeGreaterThanOrEqual(SHARED_COMMONS_WORLD.safeArea.x);
    expect(next.x).toBeLessThanOrEqual(SHARED_COMMONS_WORLD.safeArea.x + SHARED_COMMONS_WORLD.safeArea.width);
    expect(next.y).toBeGreaterThanOrEqual(SHARED_COMMONS_WORLD.safeArea.y);
    expect(next.y).toBeLessThanOrEqual(SHARED_COMMONS_WORLD.safeArea.y + SHARED_COMMONS_WORLD.safeArea.height);
    expect(next.x).toBeLessThan(motion.targetX);
  });

  it('pins reduced-motion members to authored marks with no roaming', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:reduced',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-right-outer',
    );

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
      reducedMotion: true,
    });

    expect(next.x).toBe(pointX('floor-right-outer'));
    expect(next.y).toBe(pointY('floor-right-outer'));
    expect(next.targetX).toBe(pointX('floor-right-outer'));
    expect(next.targetY).toBe(pointY('floor-right-outer'));
    expect(next.velocityX).toBe(0);
    expect(next.velocityY).toBe(0);
  });

  it('picks a meaningful new travel distance when a pause ends', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:travel',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = 214;
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = 214;
    motion.safeZoneKey = 'shared-floor';
    motion.pointKey = 'floor-mid-left';
    motion.scaleTier = 2;
    motion.pauseRemainingMs = 1;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.pauseRemainingMs).toBe(0);
    expect(Math.hypot(next.targetX - next.x, next.targetY - next.y)).toBeGreaterThanOrEqual(20);
  });

  it('settles into a pause instead of immediately retargeting when only lightly crowded at destination', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:settle-pause',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = pointY('floor-mid-left');
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = pointY('floor-mid-left');
    motion.velocityX = 0.2;
    motion.velocityY = 0;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          targetX: motion.targetX,
          targetY: motion.targetY,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        peerState({
          key: 'peer:nearby',
          x: motion.x + 24,
          y: motion.y + 1,
          targetX: motion.x + 24,
          targetY: motion.y + 1,
          pointKey: 'floor-mid-right',
          scaleTier: 2,
          renderScale: 2,
        }),
      ],
    });

    expect(next.pointKey).toBe('floor-mid-left');
    expect(next.targetX).toBe(pointX('floor-mid-left'));
    expect(next.targetY).toBe(pointY('floor-mid-left'));
    expect(next.pauseRemainingMs).toBeGreaterThan(0);
  });

  it('enters a settle phase on near-arrival instead of retargeting immediately', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:settle-phase',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left') - 10;
    motion.y = pointY('floor-mid-left') - 6;
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = pointY('floor-mid-left');
    motion.velocityX = 2.4;
    motion.velocityY = 0.8;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.movementPhase).toBe('settle');
    expect(next.targetX).toBe(pointX('floor-mid-left'));
    expect(next.targetY).toBe(pointY('floor-mid-left'));
    expect(next.pauseRemainingMs).toBe(0);
  });

  it('keeps the assigned point and safe zone when choosing a new idle beat', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:same-zone',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = 214;
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = 214;
    motion.safeZoneKey = 'shared-floor';
    motion.pointKey = 'floor-mid-left';
    motion.scaleTier = 2;
    motion.renderScale = 2;
    motion.pauseRemainingMs = 1;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.pointKey).toBe('floor-mid-left');
    expect(next.safeZoneKey).toBe('shared-floor');
    expect(next.scaleTier).toBe(2);
  });

  it('damps vertical approach without wobbling away from the destination lane', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:vertical-approach',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-right',
    );
    motion.x = pointX('floor-mid-right');
    motion.y = pointY('floor-mid-right') - 34;
    motion.targetX = pointX('floor-mid-right');
    motion.targetY = pointY('floor-mid-right');
    motion.velocityX = 0;
    motion.velocityY = 0;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(Math.abs(next.x - motion.x)).toBeLessThan(2);
    expect(Math.abs(next.targetY - next.y)).toBeLessThan(Math.abs(motion.targetY - motion.y));
  });

  it('recenters legacy far-away targets back near the assigned anchor roam area', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:legacy-target',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left') + 5;
    motion.y = 214;
    motion.targetX = pointX('floor-right-inner');
    motion.targetY = 220;
    motion.safeZoneKey = 'shared-floor';
    motion.pointKey = 'floor-mid-left';
    motion.scaleTier = 2;
    motion.renderScale = 2;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(Math.abs(next.targetX - pointX('floor-mid-left'))).toBeLessThanOrEqual(52);
    expect(Math.abs(next.targetY - pointY('floor-mid-left'))).toBeLessThanOrEqual(24);
  });

  it('can hop to an adjacent anchor when crowding is severe', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:crowded-hop',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = 214;
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = 214;
    motion.safeZoneKey = 'shared-floor';
    motion.pointKey = 'floor-mid-left';
    motion.scaleTier = 2;
    motion.renderScale = 2;
    motion.pauseRemainingMs = 1;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        peerState({ key: 'peer:1', x: 701, y: 214, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
        peerState({ key: 'peer:2', x: 699, y: 214, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
        peerState({ key: 'peer:3', x: 700, y: 215, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
      ],
    });

    expect(
      ['floor-left-mid', 'floor-mid-left', 'floor-mid-right'],
    ).toContain(next.pointKey);
    expect(next.safeZoneKey).toBe('shared-floor');
    expect(Math.hypot(next.targetX - next.x, next.targetY - next.y)).toBeGreaterThanOrEqual(10);
  });

  it('does not escape the canonical allowed point set during a crowd-driven adjacent hop', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const constrainedProfile = {
      ...profile,
      allowedPointKeys: new Set(['floor-mid-left']),
    };
    const motion = createGhostlingSceneMotionState(
      'user:constrained-hop',
      SHARED_COMMONS_WORLD,
      constrainedProfile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = pointY('floor-mid-left');
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = pointY('floor-mid-left');
    motion.pauseRemainingMs = 1;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile: constrainedProfile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        peerState({ key: 'peer:1', x: motion.x + 1, y: motion.y, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
        peerState({ key: 'peer:2', x: motion.x - 1, y: motion.y, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
        peerState({ key: 'peer:3', x: motion.x, y: motion.y + 1, pointKey: 'floor-mid-left', scaleTier: 2, renderScale: 2 }),
      ],
    });

    expect(next.pointKey).toBe('floor-mid-left');
    expect(next.safeZoneKey).toBe('shared-floor');
  });

  it('avoids forming a new destination inside another ghostling target exclusion area', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:avoid-packed-targets',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = pointY('floor-mid-left');
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = pointY('floor-mid-left');
    motion.safeZoneKey = 'shared-floor';
    motion.pointKey = 'floor-mid-left';
    motion.scaleTier = 2;
    motion.renderScale = 2;
    motion.pauseRemainingMs = 1;
    motion.opacity = 1;

    const peerFootprint = scaledGhostlingFootprint(2);
    const exclusion = {
      x: Math.max(profile.minGap * 0.55, peerFootprint.width),
      y: Math.max(profile.minGap * 0.28, peerFootprint.height),
    };

    const occupiedTargets = [
      { x: pointX('floor-mid-left'), y: pointY('floor-mid-left') },
      { x: pointX('floor-mid-left') + 18, y: pointY('floor-mid-left') + 2 },
      { x: pointX('floor-mid-left') - 22, y: pointY('floor-mid-left') - 2 },
    ];

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          targetX: motion.targetX,
          targetY: motion.targetY,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        ...occupiedTargets.map((target, index) => peerState({
          key: `peer:${index}`,
          x: target.x,
          y: target.y,
          targetX: target.x,
          targetY: target.y,
          pointKey: 'floor-mid-left',
          scaleTier: 2 as const,
          renderScale: 2,
        })),
      ],
    });

    for (const occupied of occupiedTargets) {
      expect(
        Math.abs(next.targetX - occupied.x) < exclusion.x
        && Math.abs(next.targetY - occupied.y) < exclusion.y,
      ).toBe(false);
    }
  });

  it('does not trigger breakout for a very short blocked arrival', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:no-short-breakout',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left') - 6;
    motion.y = pointY('floor-mid-left');
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = pointY('floor-mid-left');
    motion.velocityX = 0.4;
    motion.velocityY = 0;
    motion.jammedMs = 1540;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [
        peerState({
          key: motion.key,
          x: motion.x,
          y: motion.y,
          targetX: motion.targetX,
          targetY: motion.targetY,
          pointKey: motion.pointKey,
          scaleTier: motion.scaleTier,
          renderScale: motion.renderScale,
        }),
        peerState({
          key: 'peer:blocking',
          x: pointX('floor-mid-left') + 8,
          y: pointY('floor-mid-left'),
          targetX: pointX('floor-mid-left') + 8,
          targetY: pointY('floor-mid-left'),
          pointKey: 'floor-mid-right',
          scaleTier: 2,
          renderScale: 2,
        }),
      ],
    });

    expect(next.pointKey).toBe('floor-mid-left');
    expect(next.safeZoneKey).toBe('shared-floor');
    expect(next.targetX).toBe(pointX('floor-mid-left'));
    expect(next.targetY).toBe(pointY('floor-mid-left'));
    expect(next.jammedMs).toBeLessThan(1540);
  });

  it('keeps roaming scale close to its assigned layer tier', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    let probe: GhostlingSceneMotionState = createGhostlingSceneMotionState(
      'user:rear-scale',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    probe.opacity = 1;

    for (let step = 0; step < 40; step += 1) {
      probe = advanceGhostlingSceneEntity(probe, {
        dtMs: 16,
        world: SHARED_COMMONS_WORLD,
        profile,
        peers: [],
      });
      expect(probe.pointKey).toBe('floor-mid-left');
      expect(probe.safeZoneKey).toBe('shared-floor');
      expect(probe.renderScale).toBe(2);
    }
  });

  it('keeps the current facing when nearly settled at a destination', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:facing-stable',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left') - 0.6;
    motion.y = 214;
    motion.targetX = pointX('floor-mid-left');
    motion.targetY = 214;
    motion.velocityX = -0.92;
    motion.velocityY = 0;
    motion.facingLeft = false;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.facingLeft).toBe(false);
  });

  it('does not flip facing from a stray horizontal nudge while the destination stays ahead', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:facing-commit',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left') - 2;
    motion.y = 214;
    motion.targetX = pointX('floor-mid-left') + 22;
    motion.targetY = 214;
    motion.velocityX = -1.1;
    motion.velocityY = 0;
    motion.facingLeft = false;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.facingLeft).toBe(false);
  });

  it('does not flip facing for a short nearby hop even when the new target is behind it', () => {
    const profile = resolveGhostlingSceneProfile(1200, 'hero');
    const motion = createGhostlingSceneMotionState(
      'user:facing-short-hop',
      SHARED_COMMONS_WORLD,
      profile,
      'floor-mid-left',
    );
    motion.x = pointX('floor-mid-left');
    motion.y = pointY('floor-mid-left');
    motion.targetX = pointX('floor-mid-left') - 14;
    motion.targetY = pointY('floor-mid-left');
    motion.velocityX = -1.6;
    motion.velocityY = 0;
    motion.facingLeft = false;
    motion.opacity = 1;

    const next = advanceGhostlingSceneEntity(motion, {
      dtMs: 16,
      world: SHARED_COMMONS_WORLD,
      profile,
      peers: [],
    });

    expect(next.facingLeft).toBe(false);
  });
});
