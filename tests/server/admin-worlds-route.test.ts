import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { AppError } from '@/lib/server/core';
import { SHARED_COMMONS_WORLD, ghostlingWorldPackageFromSpec } from '@/lib/ghostling-world';

const { requireAdminUserMock } = vi.hoisted(() => ({
  requireAdminUserMock: vi.fn(),
}));

vi.mock('@/lib/server/ghosted-api', () => ({
  requireAdminUser: requireAdminUserMock,
}));

import { GET as getWorldsRoute } from '@/app/api/admin/worlds/route';
import { POST as postArchiveDraftAssetRoute } from '@/app/api/admin/worlds/draft/assets/archive/route';
import { POST as postDraftAssetRoute } from '@/app/api/admin/worlds/draft/assets/route';
import { POST as postDraftPackageRoute } from '@/app/api/admin/worlds/draft/package/route';
import { POST as postRestoreDraftAssetRoute } from '@/app/api/admin/worlds/draft/assets/restore/route';
import { POST as postDraftTuningRoute } from '@/app/api/admin/worlds/draft/tuning/route';
import { POST as postPublishWorldRoute } from '@/app/api/admin/worlds/publish/route';

describe('admin worlds routes', () => {
  let context: ServerTestContext;
  let actor: {
    id: number;
    username: string;
    global_name: string | null;
    is_admin: number;
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
      is_admin: 1,
    };
    requireAdminUserMock.mockReset();
    requireAdminUserMock.mockResolvedValue(actor);
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
  });

  it('requires admin auth for the worlds surface', async () => {
    requireAdminUserMock.mockRejectedValueOnce(new AppError('You do not have access to admin tools.', 403));

    const response = await getWorldsRoute();

    expect(response.status).toBe(403);
  });

  it('stages a world layer asset into draft through the admin route and records audit', async () => {
    const formData = new FormData();
    formData.set('worldId', 'shared-commons');
    formData.set('layerKey', 'foreground');
    formData.set('asset', new File(['foreground'], 'foreground.png', { type: 'image/png' }));

    const response = await postDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: formData,
    }));
    const payload = await response.json();
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'stage_world_layer_asset'
      LIMIT 1
    `).get() as { action?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.world.world.hasDraft).toBe(true);
    expect(payload.world.layers.find((layer: { key: string }) => layer.key === 'foreground')?.draftSrc).toContain('/api/world-assets/worlds/shared-commons/draft/');
    expect(auditRow?.action).toBe('stage_world_layer_asset');
  });

  it('publishes the draft world through the admin route and records the publish audit', async () => {
    const formData = new FormData();
    formData.set('worldId', 'shared-commons');
    formData.set('layerKey', 'midground');
    formData.set('asset', new File(['midground'], 'midground.png', { type: 'image/png' }));
    await postDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: formData,
    }));

    const response = await postPublishWorldRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ worldId: 'shared-commons' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'publish_world_draft'
      LIMIT 1
    `).get() as { action?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.world.world.hasPublishedVariant).toBe(true);
    expect(payload.world.world.hasDraft).toBe(false);
    expect(auditRow?.action).toBe('publish_world_draft');
  });

  it('stages draft tuning through the admin route', async () => {
    const response = await postDraftTuningRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        tuning: {
          buckets: {
            mobile: { maxVisible: 7, speedMin: 14, speedMax: 18, pauseMinMs: 320, pauseMaxMs: 720, arrivalRadius: 18, settleRadius: 2.4, minGap: 36, facingFlipVelocity: 0.75, facingFlipDistance: 14 },
            tablet: { maxVisible: 9, speedMin: 17, speedMax: 24, pauseMinMs: 360, pauseMaxMs: 760, arrivalRadius: 20, settleRadius: 2.8, minGap: 40, facingFlipVelocity: 0.82, facingFlipDistance: 15 },
            desktop: { maxVisible: 12, speedMin: 18, speedMax: 26, pauseMinMs: 420, pauseMaxMs: 880, arrivalRadius: 22, settleRadius: 3.1, minGap: 44, facingFlipVelocity: 0.9, facingFlipDistance: 16 },
          },
          shared: {
            jamBreakoutMs: 1800,
            verticalTravelFactor: 0.72,
            settleDamping: 5.4,
            minTargetTravelRatio: 0.55,
            anchorHopChance: 0.35,
          },
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'replace_world_draft_tuning'
      LIMIT 1
    `).get() as { action?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.world.draftTuning.buckets.desktop.maxVisible).toBe(12);
    expect(payload.world.world.hasDraft).toBe(true);
    expect(auditRow?.action).toBe('replace_world_draft_tuning');
  });

  it('imports pasted world package JSON through the admin route and preserves active draft layer bindings by key', async () => {
    const formData = new FormData();
    formData.set('worldId', 'shared-commons');
    formData.set('layerKey', 'midground');
    formData.set('asset', new File(['midground'], 'midground.png', { type: 'image/png' }));
    await postDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: formData,
    }));

    const pastedPackage = ghostlingWorldPackageFromSpec(SHARED_COMMONS_WORLD);
    pastedPackage.guides.safeArea = {
      ...pastedPackage.guides.safeArea,
      x: pastedPackage.guides.safeArea.x + 20,
    };
    pastedPackage.layers = pastedPackage.layers.map((layer) => ({
      ...layer,
      src: `/tmp/${layer.key}.png`,
    }));

    const response = await postDraftPackageRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        packageText: JSON.stringify(pastedPackage),
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'replace_world_draft_package'
      LIMIT 1
    `).get() as { action?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Draft world package replaced.');
    expect(payload.world.draftWorld.guides.safeArea.x).toBe(SHARED_COMMONS_WORLD.guides.safeArea.x + 20);
    expect(payload.world.layers.find((layer: { key: string }) => layer.key === 'midground')?.draftSrc)
      .toContain('/api/world-assets/worlds/shared-commons/draft/');
    expect(auditRow?.action).toBe('replace_world_draft_package');
  });

  it('rejects empty pasted world package text through the admin route', async () => {
    const response = await postDraftPackageRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        packageText: '   ',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Paste a world package JSON payload first.');
  });

  it('rejects invalid pasted world package JSON through the admin route', async () => {
    const response = await postDraftPackageRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        packageText: '{"schemaVersion":1,',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('World package must be valid JSON.');
  });

  it('imports pasted draft tuning JSON through the admin route', async () => {
    const response = await postDraftTuningRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        tuningText: JSON.stringify({
          buckets: {
            mobile: { maxVisible: 6, speedMin: 14, speedMax: 18, pauseMinMs: 320, pauseMaxMs: 720, arrivalRadius: 18, settleRadius: 2.4, minGap: 36, facingFlipVelocity: 0.75, facingFlipDistance: 14 },
            tablet: { maxVisible: 8, speedMin: 17, speedMax: 24, pauseMinMs: 360, pauseMaxMs: 760, arrivalRadius: 20, settleRadius: 2.8, minGap: 40, facingFlipVelocity: 0.82, facingFlipDistance: 15 },
            desktop: { maxVisible: 13, speedMin: 18, speedMax: 26, pauseMinMs: 420, pauseMaxMs: 880, arrivalRadius: 22, settleRadius: 3.1, minGap: 44, facingFlipVelocity: 0.9, facingFlipDistance: 16 },
          },
          shared: {
            jamBreakoutMs: 1900,
            verticalTravelFactor: 0.74,
            settleDamping: 5.6,
            minTargetTravelRatio: 0.57,
            anchorHopChance: 0.32,
          },
        }),
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Draft tuning updated.');
    expect(payload.world.draftTuning.buckets.desktop.maxVisible).toBe(13);
    expect(payload.world.draftTuning.shared.jamBreakoutMs).toBe(1900);
  });

  it('rejects invalid pasted draft tuning JSON through the admin route', async () => {
    const response = await postDraftTuningRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        tuningText: '{"buckets":',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Movement tuning must be valid JSON.');
  });

  it('rejects invalid pasted draft tuning schema through the admin route', async () => {
    const response = await postDraftTuningRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        worldId: 'shared-commons',
        tuningText: JSON.stringify({ buckets: {} }),
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Ghostling scene tuning must include buckets and shared settings.');
  });

  it('archives and restores draft layer overrides through the admin routes', async () => {
    const formData = new FormData();
    formData.set('worldId', 'shared-commons');
    formData.set('layerKey', 'foreground');
    formData.set('asset', new File(['foreground'], 'foreground.png', { type: 'image/png' }));
    await postDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: formData,
    }));

    const archiveResponse = await postArchiveDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ worldId: 'shared-commons', layerKey: 'foreground' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const archivePayload = await archiveResponse.json();

    expect(archiveResponse.status).toBe(200);
    expect(archivePayload.message).toBe('Archived foreground draft override.');
    expect(archivePayload.world.layers.find((layer: { key: string }) => layer.key === 'foreground')).toMatchObject({
      hasDraftOverride: false,
      hasArchivedOverride: true,
    });

    const restoreResponse = await postRestoreDraftAssetRoute(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ worldId: 'shared-commons', layerKey: 'foreground' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const restorePayload = await restoreResponse.json();
    const auditRows = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action IN ('archive_world_layer_asset', 'restore_world_layer_asset')
      ORDER BY id ASC
    `).all() as Array<{ action: string }>;

    expect(restoreResponse.status).toBe(200);
    expect(restorePayload.message).toBe('Restored archived foreground override.');
    expect(restorePayload.world.layers.find((layer: { key: string }) => layer.key === 'foreground')).toMatchObject({
      hasDraftOverride: true,
      hasArchivedOverride: false,
    });
    expect(auditRows.map((row) => row.action)).toEqual(['archive_world_layer_asset', 'restore_world_layer_asset']);
  });
});
