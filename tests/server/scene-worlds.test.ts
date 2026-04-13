import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultGhostlingSceneTuningSpec } from '@/lib/ghostling-scene-tuning';
import {
  SHARED_COMMONS_WORLD,
  ghostlingWorldPackageFromSpec,
} from '@/lib/ghostling-world';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { GET as getWorldAssetRoute } from '@/app/api/world-assets/[...path]/route';
import { AppError } from '@/lib/server/core';
import {
  buildAdminWorldPayload,
  discardWorldDraft,
  publishWorldDraft,
  replaceWorldDraftPackage,
  replaceWorldDraftTuning,
  resolveDraftGhostlingWorld,
  resolveDraftGhostlingWorldTuning,
  resolvePublishedGhostlingWorld,
  resolvePublishedGhostlingWorldTuning,
  stageWorldLayerAssetUpload,
  worldAssetPath,
  worldAssetUrl,
} from '@/lib/server/scene-worlds';

describe('scene world runtime repository', () => {
  let context: ServerTestContext;
  let actor: {
    id: number;
    username: string;
    global_name: string | null;
  };

  beforeEach(() => {
    context = setupServerTestEnvironment();
    actor = {
      id: insertUser(context.db, {
        username: 'admin',
        globalName: 'Admin User',
        isAdmin: 1,
      }),
      username: 'admin',
      global_name: 'Admin User',
    };
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
  });

  it('resolves the published world from repo fallback when no runtime variant exists', () => {
    const world = resolvePublishedGhostlingWorld(context.db, 'shared-commons');
    const tuning = resolvePublishedGhostlingWorldTuning(context.db, 'shared-commons');
    const payload = buildAdminWorldPayload(context.db, actor);

    expect(world.sourceWidth).toBe(SHARED_COMMONS_WORLD.sourceWidth);
    expect(tuning.buckets.desktop.maxVisible).toBe(createDefaultGhostlingSceneTuningSpec().buckets.desktop.maxVisible);
    expect(world.layers[0]?.src).toContain('/api/world-assets/repo/worlds/shared-commons/v1/');
    expect(payload.world.hasPublishedVariant).toBe(false);
    expect(payload.world.hasDraft).toBe(false);
  });

  it('stages layer assets in draft, rebinds uploaded package src values by layer key, and publishes to runtime storage', () => {
    const staged = stageWorldLayerAssetUpload(
      context.db,
      actor,
      'shared-commons',
      'foreground',
      {
        filename: 'foreground.png',
        contentType: 'image/png',
        data: Buffer.from('foreground-image'),
      },
    );

    expect(staged.world.hasDraft).toBe(true);
    expect(staged.layers.find((layer) => layer.key === 'foreground')?.draftSrc).toContain('/api/world-assets/worlds/shared-commons/draft/');

    const uploadedPackage = ghostlingWorldPackageFromSpec(SHARED_COMMONS_WORLD);
    uploadedPackage.layers = uploadedPackage.layers.map((layer) => ({
      ...layer,
      src: `/bogus/${layer.key}.png`,
      zIndex: layer.zIndex + 10,
    }));
    uploadedPackage.guides.safeArea = {
      ...uploadedPackage.guides.safeArea,
      x: uploadedPackage.guides.safeArea.x + 12,
    };

    replaceWorldDraftPackage(context.db, actor, 'shared-commons', JSON.stringify(uploadedPackage));

    const draftWorld = resolveDraftGhostlingWorld(context.db, 'shared-commons');
    expect(draftWorld.guides.safeArea.x).toBe(SHARED_COMMONS_WORLD.guides.safeArea.x + 12);
    expect(draftWorld.layers.find((layer) => layer.key === 'foreground')?.src).toContain('/api/world-assets/worlds/shared-commons/draft/');

    const published = publishWorldDraft(context.db, actor, 'shared-commons');
    expect(published.world.hasPublishedVariant).toBe(true);
    expect(published.world.hasDraft).toBe(false);
    expect(published.publishedWorld.layers.find((layer) => layer.key === 'foreground')?.src).toContain('/api/world-assets/worlds/shared-commons/published/foreground.png');
    expect(fs.existsSync(worldAssetPath('worlds/shared-commons/published/foreground.png'))).toBe(true);
  });

  it('discards draft-only changes back to the current published world', () => {
    stageWorldLayerAssetUpload(
      context.db,
      actor,
      'shared-commons',
      'foreground',
      {
        filename: 'foreground.png',
        contentType: 'image/png',
        data: Buffer.from('published-foreground'),
      },
    );
    publishWorldDraft(
      context.db,
      actor,
      'shared-commons',
      {
        onPublish: () => undefined,
      },
    );

    stageWorldLayerAssetUpload(
      context.db,
      actor,
      'shared-commons',
      'midground',
      {
        filename: 'midground.png',
        contentType: 'image/png',
        data: Buffer.from('draft-midground'),
      },
    );

    const draftWorld = resolveDraftGhostlingWorld(context.db, 'shared-commons');
    const publishedBeforeDiscard = resolvePublishedGhostlingWorld(context.db, 'shared-commons');
    expect(draftWorld.layers.find((layer) => layer.key === 'midground')?.src)
      .not.toBe(publishedBeforeDiscard.layers.find((layer) => layer.key === 'midground')?.src);

    const discarded = discardWorldDraft(context.db, actor, 'shared-commons');
    expect(discarded.world.hasDraft).toBe(false);

    const resolvedAfterDiscard = resolveDraftGhostlingWorld(context.db, 'shared-commons');
    expect(resolvedAfterDiscard.layers.find((layer) => layer.key === 'midground')?.src)
      .toBe(resolvePublishedGhostlingWorld(context.db, 'shared-commons').layers.find((layer) => layer.key === 'midground')?.src);
  });

  it('stages and publishes runtime tuning alongside the world package', () => {
    const nextTuning = createDefaultGhostlingSceneTuningSpec();
    nextTuning.buckets.desktop.maxVisible = 14;
    nextTuning.buckets.tablet.maxVisible = 11;
    nextTuning.buckets.mobile.maxVisible = 8;

    const staged = replaceWorldDraftTuning(context.db, actor, 'shared-commons', nextTuning);
    expect(staged.world.hasDraft).toBe(true);
    expect(staged.draftTuning.buckets.desktop.maxVisible).toBe(14);

    const draftTuning = resolveDraftGhostlingWorldTuning(context.db, 'shared-commons');
    expect(draftTuning.buckets.mobile.maxVisible).toBe(8);

    const published = publishWorldDraft(context.db, actor, 'shared-commons');
    expect(published.draftTuning.buckets.tablet.maxVisible).toBe(11);
    expect(resolvePublishedGhostlingWorldTuning(context.db, 'shared-commons').buckets.desktop.maxVisible).toBe(14);

    const discarded = discardWorldDraft(context.db, actor, 'shared-commons');
    expect(discarded.world.hasDraft).toBe(false);
    expect(discarded.draftTuning.buckets.desktop.maxVisible).toBe(14);
  });

  it('rejects invalid uploaded world packages and serves runtime assets through the world asset route', async () => {
    const invalidPackage = {
      ...ghostlingWorldPackageFromSpec(SHARED_COMMONS_WORLD),
      worldId: 'wrong-world',
    };

    expect(() => replaceWorldDraftPackage(
      context.db,
      actor,
      'shared-commons',
      JSON.stringify(invalidPackage),
    )).toThrow(AppError);

    const repoLayerUrl = worldAssetUrl('repo/worlds/shared-commons/v1/sky.svg');
    const repoResponse = await getWorldAssetRoute(new Request('http://localhost'), {
      params: Promise.resolve({
        path: String(repoLayerUrl).replace('/api/world-assets/', '').split('/'),
      }),
    });

    expect(repoResponse.status).toBe(200);
    expect(repoResponse.headers.get('Content-Type')).toContain('image/svg+xml');

    const missingResponse = await getWorldAssetRoute(new Request('http://localhost'), {
      params: Promise.resolve({
        path: ['..', 'escape'],
      }),
    });

    expect(missingResponse.status).toBe(404);
  });
});
