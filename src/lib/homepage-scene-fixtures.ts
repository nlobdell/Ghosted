import { SHARED_COMMONS_WORLD, type GhostlingWorldSpec } from '@/lib/ghostling-world';
import { DEFAULT_GHOSTLING_ACTOR_METRICS } from '@/lib/ghostling-actor';
import type {
  CompanionPreviewSummary,
  ScenePresenceActivity,
  ScenePresenceMember,
  ScenePresencePayload,
  SceneSharedEntityState,
} from '@/lib/types';

export type HomePageSceneFixtureId = 'visual-baseline';

const FIXTURE_MEMBER_NAMES = [
  'Ritual Watch',
  'Catacomb Ward',
  'Sanguine Echo',
  'Lantern Wisp',
  'Ivory Shade',
  'Velvet Omen',
];

function fixtureActivity(): ScenePresenceActivity {
  return {
    firstSeenAt: '2026-04-12T18:00:00.000Z',
    lastSeenAt: '2026-04-12T18:00:00.000Z',
    freshness: 'steady',
    strength: 'high',
  };
}

function fallbackPreviewSummary(): CompanionPreviewSummary {
  return {
    user: null,
    renderUrl: '/api/companion/render',
    animatedRenderUrl: '/api/companion/render-animated',
    actorMetrics: DEFAULT_GHOSTLING_ACTOR_METRICS,
    renderManifest: {
      width: 70,
      height: 70,
      motion: {
        shadowOpacity: 0.2,
        rootGroup: 'root',
        channels: {
          root: {},
        },
        slotGroups: {},
        accents: [],
      },
      layers: [],
    },
  };
}

export function buildHomePageSceneFixture(
  fixtureId: HomePageSceneFixtureId,
  previewSummary?: CompanionPreviewSummary | null,
  memberCount?: number,
  worldSpec: GhostlingWorldSpec = SHARED_COMMONS_WORLD,
): ScenePresencePayload {
  if (fixtureId !== 'visual-baseline') {
    throw new Error(`Unsupported homepage scene fixture "${fixtureId}".`);
  }

  const preview = previewSummary ?? fallbackPreviewSummary();
  const activity = fixtureActivity();
  const points = [
    'floor-left-outer',
    'floor-left-mid',
    'floor-mid-left',
    'floor-mid-right',
    'floor-right-mid',
    'floor-right-outer',
  ].map((pointKey) => worldSpec.points.find((point) => point.key === pointKey))
    .filter((point): point is NonNullable<(typeof worldSpec.points)[number]> => Boolean(point));

  const limitedPoints = points.slice(0, Math.max(1, Math.min(memberCount ?? points.length, points.length)));

  const members: ScenePresenceMember[] = limitedPoints.map((point, index) => ({
    key: `fixture:${index + 1}`,
    userId: null,
    username: FIXTURE_MEMBER_NAMES[index] ?? `Fixture ${index + 1}`,
    displayName: FIXTURE_MEMBER_NAMES[index] ?? `Fixture ${index + 1}`,
    source: 'voice',
    voiceSource: 'widget',
    activity,
    companion: preview,
  }));

  const entities: SceneSharedEntityState[] = limitedPoints.map((point, index) => ({
    key: members[index]!.key,
    x: point.x,
    y: point.y,
    targetX: point.x,
    targetY: point.y,
    speed: 18,
    velocityX: 0,
    velocityY: 0,
    pauseRemainingMs: 60_000,
    phaseRemainingMs: 60_000,
    targetSerial: 0,
    safeZoneKey: point.safeZoneKey,
    pointKey: point.key,
    scaleTier: point.scaleTier,
    renderScale: point.scaleTier,
    movementPhase: 'paused',
    facingLeft: index % 2 === 0,
    opacity: 1,
    jammedMs: 0,
    fallback: false,
    source: 'voice',
    activeUntilTs: 0,
    lastSeenSignature: `fixture:${index + 1}:steady`,
    actorMetrics: preview.actorMetrics,
  }));

  return {
    source: 'voice',
    members,
    sharedScene: {
      hero: {
        version: 1,
        variant: 'hero',
        width: worldSpec.sourceWidth,
        height: worldSpec.sourceHeight,
        savedAt: Date.now(),
        payloadSource: 'voice',
        liveCount: members.length,
        entities,
      },
    },
  };
}
