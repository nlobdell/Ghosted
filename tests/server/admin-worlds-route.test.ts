import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import { AppError } from '@/lib/server/core';

const { requireAdminUserMock } = vi.hoisted(() => ({
  requireAdminUserMock: vi.fn(),
}));

vi.mock('@/lib/server/ghosted-api', () => ({
  requireAdminUser: requireAdminUserMock,
}));

import { GET as getWorldsRoute } from '@/app/api/admin/worlds/route';
import { POST as postDraftAssetRoute } from '@/app/api/admin/worlds/draft/assets/route';
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
});
