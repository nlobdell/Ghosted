import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
const { authMock, cookiesMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

import { GET as getCompanionRoute } from '@/app/api/companion/route';
import { GET as getCompanionPreviewRoute } from '@/app/api/companion/preview/route';
import { POST as postCompanionPurchaseRoute } from '@/app/api/companion/purchase/route';
import { POST as postCompanionEquipRoute } from '@/app/api/companion/equip/route';
import { POST as postCompanionAdminBaseRoute } from '@/app/api/companion/admin/base/route';
import { POST as postCompanionAdminImportRepoRoute } from '@/app/api/companion/admin/items/import-repo/route';
import { POST as postCompanionAdminItemsRoute } from '@/app/api/companion/admin/items/route';
import { POST as postCompanionAdminArchiveRoute } from '@/app/api/companion/admin/items/archive/route';
import { POST as postCompanionAdminDeleteRoute } from '@/app/api/companion/admin/items/delete/route';
import { POST as postCompanionAdminReorderRoute } from '@/app/api/companion/admin/items/reorder/route';
import { POST as postCompanionAdminReplaceAssetsRoute } from '@/app/api/companion/admin/items/replace-assets/route';
import { POST as postCompanionAdminRestoreRoute } from '@/app/api/companion/admin/items/restore/route';
import { POST as postCompanionAdminUpdateRoute } from '@/app/api/companion/admin/items/update/route';
import { POST as postCompanionAdminVisibilityRoute } from '@/app/api/companion/admin/items/visibility/route';
import { GET as getCompanionAdminLibraryRoute } from '@/app/api/companion/admin/library/route';
import { createCompanionItem } from '@/lib/server/companion';
import { setUserPublicNameSource } from '@/lib/server/osrs-identity';
import { saveUserGameAccount } from '@/lib/server/wom';
import { PLAYER } from './wom-fixtures';

function getUser(context: ServerTestContext, userId: number) {
  return context.db.prepare(`
    SELECT id, username, global_name
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; username: string; global_name: string | null };
}

function svgBuffer(fill = '#7c5cff') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`,
    'utf8',
  );
}

function svgFile(filename: string, fill = '#7c5cff') {
  return new File([svgBuffer(fill)], filename, { type: 'image/svg+xml' });
}

function ghostlingMetadata(
  slot: 'hat' | 'face' | 'neck' | 'body',
  overrides: Partial<{
    canvas: { width: number; height: number };
    baseRect: { x: number; y: number; width: number; height: number };
    mount: { x: number; y: number };
    pieces: {
      front?: { docRect: { x: number; y: number; width: number; height: number } };
      back?: { docRect: { x: number; y: number; width: number; height: number } };
    };
  }> = {},
) {
  return {
    kind: 'ghostling-cosmetic',
    schemaVersion: 1,
    slot,
    canvas: overrides.canvas ?? { width: 210, height: 260 },
    baseRect: overrides.baseRect ?? { x: 0, y: 21, width: 210, height: 210 },
    mount: overrides.mount ?? { x: 105, y: 90 },
    pieces: overrides.pieces ?? {
      front: {
        docRect: { x: 100, y: 30, width: 12, height: 10 },
      },
    },
  };
}

function metadataFile(filename: string, metadata: Record<string, unknown>) {
  return new File([JSON.stringify(metadata)], filename, { type: 'application/json' });
}

function seedCompanionItem(
  context: ServerTestContext,
  actorId: number,
  options: { name: string; slot: string; cost?: number; rarity?: string; fill?: string },
) {
  return createCompanionItem(context.db, getUser(context, actorId), {
    name: options.name,
    slot: options.slot,
    rarity: options.rarity ?? 'common',
    cost: options.cost ?? 0,
    description: '',
    frontAsset: {
      filename: `${options.name.toLowerCase().replaceAll(/\s+/g, '-')}-front.svg`,
      contentType: 'image/svg+xml',
      data: svgBuffer(options.fill),
    },
  });
}

describe('companion route handlers', () => {
  let context: ServerTestContext;
  let repoFixturePaths: string[];

  beforeEach(() => {
    context = setupServerTestEnvironment();
    repoFixturePaths = [];
    authMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    for (const fixturePath of repoFixturePaths) {
      fs.rmSync(fixturePath, { force: true });
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns 401 for unauthenticated companion requests', async () => {
    authMock.mockResolvedValue(null);

    const response = await getCompanionRoute();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Please sign in with Discord first.' });
  });

  it('returns the signed-in companion payload', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });

    const response = await getCompanionRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({ id: userId, displayName: 'Member' });
    expect(payload.items).toEqual([]);
  });

  it('prefers the claimed OSRS name on member-facing companion payloads', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Discord Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    setUserPublicNameSource(context.db, userId, 'osrs');

    const response = await getCompanionRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({ id: userId, displayName: PLAYER.displayName });
  });

  it('returns a public house preview summary without requiring auth', async () => {
    const response = await getCompanionPreviewRoute(new Request('http://localhost/api/companion/preview'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toBeNull();
    expect(payload.renderUrl).toBe('/api/companion/render?base=1');
    expect(payload.animatedRenderUrl).toBe('/api/companion/render-animated?base=1');
    expect(payload.renderManifest.motion.accents.length).toBeGreaterThan(0);
    expect(payload.renderManifest.debug.slotAnchors.hat).toEqual({ x: 105, y: 72 });
  });

  it('returns a public preview summary for a specific user reference', async () => {
    const userId = insertUser(context.db, { discordId: 'member-123', username: 'member', globalName: 'Member' });

    const response = await getCompanionPreviewRoute(new Request(`http://localhost/api/companion/preview?user=${userId}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toEqual({ displayName: 'Member', username: 'member' });
    expect(payload.animatedRenderUrl).toContain(`user=${userId}`);
    expect(payload.renderManifest.debug.shadowRect.width).toBeGreaterThan(0);
  });

  it('returns the expected purchase success envelope', async () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    addRewardLedgerEntry(context.db, userId, 200, 'welcome_bonus', 'Initial points');
    seedCompanionItem(context, actorId, { name: 'Moon Hood', slot: 'hat', cost: 120 });

    const response = await postCompanionPurchaseRoute(new Request('http://localhost/api/companion/purchase', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Companion cosmetic unlocked.');
    expect(payload.companion.loadout.hat).toBe('moon-hood');
  });

  it('returns the expected equip error envelope for unowned cosmetics', async () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    seedCompanionItem(context, actorId, { name: 'Moon Hood', slot: 'hat', cost: 0 });

    const response = await postCompanionEquipRoute(new Request('http://localhost/api/companion/equip', {
      method: 'POST',
      body: JSON.stringify({ slot: 'hat', slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Unlock the cosmetic before equipping it.' });
  });

  it('returns the admin library payload for admins and 403 for non-admins', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const successResponse = await getCompanionAdminLibraryRoute();
    const successPayload = await successResponse.json();

    expect(successResponse.status).toBe(200);
    expect(successPayload.base.assetPath).toContain('ghostling-base-body.png');
    expect(successPayload.base.bodyAssetPath).toContain('ghostling-base-body.png');
    expect(successPayload.base.headAssetPath).toContain('ghostling-base-head.png');
    expect(successPayload.base.renderManifest.width).toBe(70);
    expect(successPayload.base.renderManifest.height).toBe(70);
    expect(successPayload.base.renderManifest.layers.map((layer: { role: string }) => layer.role)).toEqual([
      'base-right-hand',
      'base-body',
      'base-left-hand',
      'base-head',
    ]);
    expect(successPayload.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-right-hand.png'))).toBe(true);
    expect(successPayload.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
    expect(successPayload.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-head.png'))).toBe(true);

    const memberId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(memberId) } });

    const forbiddenResponse = await getCompanionAdminLibraryRoute();
    const forbiddenPayload = await forbiddenResponse.json();

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenPayload).toEqual({ error: 'You do not have access to admin tools.' });
  });

  it('accepts multipart body-only base uploads and preserves the layered head fallback', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const formData = new FormData();
    formData.set('bodyAsset', svgFile('ghostling-base-body.svg', '#22cc88'));

    const response = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: formData,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Companion base updated.');
    expect(payload.library.base.assetPath).toContain('uploads/base/');
    expect(payload.library.base.bodyAssetPath).toContain('uploads/base/');
    expect(payload.library.base.headAssetPath).toContain('ghostling-base-head.png');
    expect(payload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-right-hand.png'))).toBe(true);
    expect(payload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
    expect(payload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-head.png'))).toBe(true);
    expect(payload.companion.baseAssetUrl).toContain('uploads/base/');
  });

  it('accepts optional head overrides and still supports the legacy base asset field name', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const legacyFormData = new FormData();
    legacyFormData.set('asset', svgFile('legacy-ghostling-base.svg', '#22cc88'));
    const legacyResponse = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: legacyFormData,
    }));
    const legacyPayload = await legacyResponse.json();

    expect(legacyResponse.status).toBe(201);
    expect(legacyPayload.library.base.bodyAssetPath).toContain('uploads/base/');

    const layeredFormData = new FormData();
    layeredFormData.set('bodyAsset', svgFile('ghostling-base-body.svg', '#3366ff'));
    layeredFormData.set('headAsset', svgFile('ghostling-base-head.svg', '#ff66aa'));
    const layeredResponse = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: layeredFormData,
    }));
    const layeredPayload = await layeredResponse.json();

    expect(layeredResponse.status).toBe(201);
    expect(layeredPayload.library.base.bodyAssetPath).toContain('uploads/base/');
    expect(layeredPayload.library.base.headAssetPath).toContain('uploads/base/');
    expect(layeredPayload.library.base.headAssetUrl).toContain('uploads/base/');
    expect(layeredPayload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('uploads/base/'))).toBe(true);
    expect(layeredPayload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-right-hand.png'))).toBe(true);
    expect(layeredPayload.library.base.renderManifest.layers.some((layer: { src: string }) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
  });

  it('creates a custom companion item from multipart uploads', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const formData = new FormData();
    formData.set('name', 'Moon Hood');
    formData.set('slot', 'hat');
    formData.set('rarity', 'rare');
    formData.set('cost', '120');
    formData.set('description', 'Night market hood.');
    formData.set('frontAsset', svgFile('moon-hood-front.svg'));

    const response = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: formData,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Custom companion cosmetic created.');
    expect(payload.library.items[0]).toMatchObject({
      slug: 'moon-hood',
      slot: 'hat',
      cost: 120,
    });
  });

  it('stores valid anchor metadata and rejects invalid metadata uploads', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const slotMismatch = new FormData();
    slotMismatch.set('name', 'Mismatch Hood');
    slotMismatch.set('slot', 'hat');
    slotMismatch.set('rarity', 'rare');
    slotMismatch.set('cost', '120');
    slotMismatch.set('frontAsset', svgFile('mismatch-hood-front.svg'));
    slotMismatch.set('metadata', metadataFile('mismatch-hood.ghostling.json', ghostlingMetadata('face')));

    const slotMismatchResponse = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: slotMismatch,
    }));
    const slotMismatchPayload = await slotMismatchResponse.json();

    expect(slotMismatchResponse.status).toBe(400);
    expect(slotMismatchPayload.error).toContain('selected "hat" slot');

    const missingBack = new FormData();
    missingBack.set('name', 'Missing Back');
    missingBack.set('slot', 'hat');
    missingBack.set('rarity', 'rare');
    missingBack.set('cost', '120');
    missingBack.set('frontAsset', svgFile('missing-back-front.svg'));
    missingBack.set('metadata', metadataFile('missing-back.ghostling.json', ghostlingMetadata('hat', {
      pieces: {
        front: { docRect: { x: 100, y: 30, width: 12, height: 10 } },
        back: { docRect: { x: 94, y: 26, width: 16, height: 12 } },
      },
    })));

    const missingBackResponse = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: missingBack,
    }));
    const missingBackPayload = await missingBackResponse.json();

    expect(missingBackResponse.status).toBe(400);
    expect(missingBackPayload.error).toContain('back piece');

    const outOfBoundsMount = new FormData();
    outOfBoundsMount.set('name', 'Out Of Bounds');
    outOfBoundsMount.set('slot', 'hat');
    outOfBoundsMount.set('rarity', 'rare');
    outOfBoundsMount.set('cost', '120');
    outOfBoundsMount.set('frontAsset', svgFile('out-of-bounds-front.svg'));
    outOfBoundsMount.set('metadata', metadataFile('out-of-bounds.ghostling.json', ghostlingMetadata('hat', {
      mount: { x: 999, y: 90 },
    })));

    const outOfBoundsResponse = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: outOfBoundsMount,
    }));
    const outOfBoundsPayload = await outOfBoundsResponse.json();

    expect(outOfBoundsResponse.status).toBe(400);
    expect(outOfBoundsPayload.error).toContain('mount');

    const validFormData = new FormData();
    validFormData.set('name', 'Anchor Hood');
    validFormData.set('slot', 'hat');
    validFormData.set('rarity', 'rare');
    validFormData.set('cost', '120');
    validFormData.set('frontAsset', svgFile('anchor-hood-front.svg'));
    validFormData.set('metadata', metadataFile('anchor-hood.ghostling.json', ghostlingMetadata('hat')));

    const response = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: validFormData,
    }));
    const payload = await response.json();
    const storedRow = context.db.prepare(`
      SELECT render_metadata_json
      FROM companion_catalog
      WHERE slug = 'anchor-hood'
    `).get() as { render_metadata_json: string | null };

    expect(response.status).toBe(201);
    expect(payload.library.items[0].renderMetadata).toMatchObject({
      slot: 'hat',
      mount: { x: 105, y: 90 },
    });
    expect(storedRow.render_metadata_json).toContain('"kind":"ghostling-cosmetic"');
  });

  it('updates companion metadata and slug through the admin route', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat', cost: 50 });

    const response = await postCompanionAdminUpdateRoute(new Request('http://localhost/api/companion/admin/items/update', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'moon-hood',
        name: 'Sun Hood',
        nextSlug: 'sun-hood',
        rarity: 'legendary',
        cost: 220,
        description: 'Solar market hood.',
        metadataJson: JSON.stringify(ghostlingMetadata('hat')),
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const auditRow = context.db.prepare(`
      SELECT action, target_id
      FROM audit_log
      WHERE action = 'update_companion_item'
      ORDER BY id DESC
      LIMIT 1
    `).get() as { action?: string; target_id?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Companion cosmetic updated.');
    expect(payload.library.items.find((item: { slug: string }) => item.slug === 'sun-hood')).toMatchObject({
      name: 'Sun Hood',
      rarity: 'legendary',
      cost: 220,
      renderMetadata: { slot: 'hat' },
    });
    expect(payload.library.items.find((item: { slug: string }) => item.slug === 'moon-hood')).toBeUndefined();
    expect(auditRow).toEqual({ action: 'update_companion_item', target_id: 'sun-hood' });
  });

  it('replaces assets, toggles visibility, and reorders companion cosmetics', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat', cost: 50 });
    seedCompanionItem(context, adminId, { name: 'Silver Crown', slot: 'hat', cost: 75, fill: '#57b8ff' });

    const replaceData = new FormData();
    replaceData.set('slug', 'moon-hood');
    replaceData.set('frontAsset', svgFile('moon-hood-front-v2.svg', '#ff66aa'));
    const replaceResponse = await postCompanionAdminReplaceAssetsRoute(new Request('http://localhost/api/companion/admin/items/replace-assets', {
      method: 'POST',
      body: replaceData,
    }));
    const replacePayload = await replaceResponse.json();
    const replacedItem = replacePayload.library.items.find((item: { slug: string }) => item.slug === 'moon-hood');

    expect(replaceResponse.status).toBe(200);
    expect(replacePayload.message).toBe('Companion assets replaced.');
    expect(replacedItem.frontAssetPath).toContain('uploads/items/');

    const visibilityResponse = await postCompanionAdminVisibilityRoute(new Request('http://localhost/api/companion/admin/items/visibility', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood', active: false }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const visibilityPayload = await visibilityResponse.json();
    const hiddenItem = visibilityPayload.library.items.find((item: { slug: string }) => item.slug === 'moon-hood');

    expect(visibilityResponse.status).toBe(200);
    expect(visibilityPayload.message).toBe('Companion visibility updated.');
    expect(hiddenItem.active).toBe(false);

    const reorderResponse = await postCompanionAdminReorderRoute(new Request('http://localhost/api/companion/admin/items/reorder', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood', direction: 'down' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const reorderPayload = await reorderResponse.json();
    const hatItems = reorderPayload.library.items.filter((item: { slot: string }) => item.slot === 'hat');

    expect(reorderResponse.status).toBe(200);
    expect(reorderPayload.message).toBe('Companion order updated.');
    expect(hatItems.map((item: { slug: string }) => item.slug)).toEqual(['silver-crown', 'moon-hood']);
  });

  it('preserves existing anchor metadata when replacing art without a new metadata sidecar', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const createData = new FormData();
    createData.set('name', 'Anchor Crown');
    createData.set('slot', 'hat');
    createData.set('rarity', 'rare');
    createData.set('cost', '120');
    createData.set('frontAsset', svgFile('anchor-crown-front.svg', '#88c0ff'));
    createData.set('metadata', metadataFile('anchor-crown.ghostling.json', ghostlingMetadata('hat')));

    const createResponse = await postCompanionAdminItemsRoute(new Request('http://localhost/api/companion/admin/items', {
      method: 'POST',
      body: createData,
    }));
    expect(createResponse.status).toBe(201);

    const replaceData = new FormData();
    replaceData.set('slug', 'anchor-crown');
    replaceData.set('frontAsset', svgFile('anchor-crown-front-v2.svg', '#ff66aa'));

    const replaceResponse = await postCompanionAdminReplaceAssetsRoute(new Request('http://localhost/api/companion/admin/items/replace-assets', {
      method: 'POST',
      body: replaceData,
    }));
    const replacePayload = await replaceResponse.json();
    const replacedItem = replacePayload.library.items.find((item: { slug: string }) => item.slug === 'anchor-crown');
    const storedRow = context.db.prepare(`
      SELECT render_metadata_json
      FROM companion_catalog
      WHERE slug = 'anchor-crown'
    `).get() as { render_metadata_json: string | null };

    expect(replaceResponse.status).toBe(200);
    expect(replacedItem.renderMetadata).toMatchObject({
      slot: 'hat',
      mount: { x: 105, y: 90 },
    });
    expect(storedRow.render_metadata_json).toContain('"kind":"ghostling-cosmetic"');
  });

  it('archives and restores cosmetics through the admin routes with audit visibility', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat', cost: 50 });

    const archiveResponse = await postCompanionAdminArchiveRoute(new Request('http://localhost/api/companion/admin/items/archive', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const archivePayload = await archiveResponse.json();

    expect(archiveResponse.status).toBe(200);
    expect(archivePayload.message).toBe('Companion cosmetic archived.');
    expect(archivePayload.library.items.find((item: { slug: string }) => item.slug === 'moon-hood')).toBeUndefined();
    expect(archivePayload.library.archivedItems.find((item: { slug: string }) => item.slug === 'moon-hood')).toMatchObject({
      state: 'archived',
      archived: true,
    });

    const restoreResponse = await postCompanionAdminRestoreRoute(new Request('http://localhost/api/companion/admin/items/restore', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const restorePayload = await restoreResponse.json();
    const auditRows = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action IN ('archive_companion_item', 'restore_companion_item')
      ORDER BY id ASC
    `).all() as Array<{ action: string }>;

    expect(restoreResponse.status).toBe(200);
    expect(restorePayload.message).toBe('Companion cosmetic restored.');
    expect(restorePayload.library.items.find((item: { slug: string }) => item.slug === 'moon-hood')).toMatchObject({
      state: 'visible',
      archived: false,
    });
    expect(restorePayload.library.recentAudit.some((entry: { action: string }) => entry.action === 'archive_companion_item')).toBe(true);
    expect(restorePayload.library.recentAudit.some((entry: { action: string }) => entry.action === 'restore_companion_item')).toBe(true);
    expect(auditRows.map((row) => row.action)).toEqual(['archive_companion_item', 'restore_companion_item']);
  });

  it('hard deletes archived cosmetics through the admin route and preserves the success envelope', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const memberId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    addRewardLedgerEntry(context.db, memberId, 100, 'welcome_bonus', 'Initial points');
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat', cost: 50 });
    authMock.mockResolvedValueOnce({ user: { id: String(memberId) } });
    await postCompanionPurchaseRoute(new Request('http://localhost/api/companion/purchase', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    await postCompanionAdminArchiveRoute(new Request('http://localhost/api/companion/admin/items/archive', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));

    const response = await postCompanionAdminDeleteRoute(new Request('http://localhost/api/companion/admin/items/delete', {
      method: 'POST',
      body: JSON.stringify({ slug: 'moon-hood' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();
    const inventoryCount = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM user_companion_inventory
      WHERE item_slug = 'moon-hood'
    `).get() as { count: number };
    const loadoutRow = context.db.prepare(`
      SELECT hat_item_slug
      FROM user_companion_loadout
      WHERE user_id = ?
    `).get(memberId) as { hat_item_slug: string | null };
    const auditRow = context.db.prepare(`
      SELECT action
      FROM audit_log
      WHERE action = 'delete_companion_item'
      ORDER BY id DESC
      LIMIT 1
    `).get() as { action?: string } | undefined;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Companion cosmetic permanently deleted.');
    expect(payload.library.archivedItems.find((item: { slug: string }) => item.slug === 'moon-hood')).toBeUndefined();
    expect(payload.library.recentAudit.some((entry: { action: string }) => entry.action === 'delete_companion_item')).toBe(true);
    expect(inventoryCount.count).toBe(0);
    expect(loadoutRow.hat_item_slug).toBeNull();
    expect(auditRow?.action).toBe('delete_companion_item');
  });

  it('imports repo cosmetics and preserves the expected success envelope', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const repoItemsDir = path.join(process.cwd(), 'assets', 'companion', 'defaults', 'items');
    fs.mkdirSync(repoItemsDir, { recursive: true });
    const assetName = `route-crown-${Date.now()}-front.svg`;
    const assetPath = path.join(repoItemsDir, assetName);
    repoFixturePaths.push(assetPath);
    fs.writeFileSync(assetPath, svgBuffer('#ffaa55'));

    const response = await postCompanionAdminImportRepoRoute(new Request('http://localhost/api/companion/admin/items/import-repo', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          slug: 'route-crown',
          name: 'Route Crown',
          slot: 'hat',
          rarity: 'rare',
          cost: 90,
          description: 'Imported from repo.',
          frontAssetPath: `repo/defaults/items/${assetName}`,
        }],
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Repo Ghostling cosmetics imported.');
    expect(payload.library.items.find((item: { slug: string }) => item.slug === 'route-crown')).toMatchObject({
      slug: 'route-crown',
      slot: 'hat',
      frontAssetPath: `repo/defaults/items/${assetName}`,
    });
  });

  it('exposes repo sidecar metadata and imports it into the catalog', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const repoItemsDir = path.join(process.cwd(), 'assets', 'companion', 'defaults', 'items');
    fs.mkdirSync(repoItemsDir, { recursive: true });
    const assetName = 'route-anchor-front.svg';
    const assetPath = path.join(repoItemsDir, assetName);
    const metadataName = assetName.replace(/-front\.svg$/, '.ghostling.json');
    const metadataPath = path.join(repoItemsDir, metadataName);
    repoFixturePaths.push(assetPath, metadataPath);
    fs.writeFileSync(assetPath, svgBuffer('#88c0ff'));
    fs.writeFileSync(metadataPath, JSON.stringify(ghostlingMetadata('hat')));

    const libraryResponse = await getCompanionAdminLibraryRoute();
    const libraryPayload = await libraryResponse.json();
    const candidate = libraryPayload.repoCandidates.find((item: { slug: string }) => item.slug === 'route-anchor');

    expect(libraryResponse.status).toBe(200);
    expect(candidate).toMatchObject({
      slug: 'route-anchor',
      renderMetadataPath: `repo/defaults/items/${metadataName}`,
      renderMetadata: { slot: 'hat' },
    });
    expect(candidate.renderMetadataErrors).toEqual([]);

    const importResponse = await postCompanionAdminImportRepoRoute(new Request('http://localhost/api/companion/admin/items/import-repo', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          slug: 'route-anchor',
          name: 'Route Anchor',
          slot: 'hat',
          rarity: 'rare',
          cost: 90,
          description: 'Imported with metadata.',
          frontAssetPath: `repo/defaults/items/${assetName}`,
          renderMetadataPath: `repo/defaults/items/${metadataName}`,
        }],
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const importPayload = await importResponse.json();
    const storedRow = context.db.prepare(`
      SELECT render_metadata_json
      FROM companion_catalog
      WHERE slug = 'route-anchor'
    `).get() as { render_metadata_json: string | null };

    expect(importResponse.status).toBe(201);
    expect(importPayload.library.items.find((item: { slug: string }) => item.slug === 'route-anchor')).toMatchObject({
      slug: 'route-anchor',
      renderMetadata: { slot: 'hat' },
    });
    expect(storedRow.render_metadata_json).toContain('"schemaVersion":1');
  });

  it('surfaces invalid repo sidecar metadata in the admin library payload', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const repoItemsDir = path.join(process.cwd(), 'assets', 'companion', 'defaults', 'items');
    fs.mkdirSync(repoItemsDir, { recursive: true });
    const assetName = 'broken-anchor-front.svg';
    const assetPath = path.join(repoItemsDir, assetName);
    const metadataName = assetName.replace(/-front\.svg$/, '.ghostling.json');
    const metadataPath = path.join(repoItemsDir, metadataName);
    repoFixturePaths.push(assetPath, metadataPath);
    fs.writeFileSync(assetPath, svgBuffer('#ff7799'));
    fs.writeFileSync(metadataPath, JSON.stringify(ghostlingMetadata('hat', {
      mount: { x: 999, y: 90 },
    })));

    const response = await getCompanionAdminLibraryRoute();
    const payload = await response.json();
    const candidate = payload.repoCandidates.find((item: { slug: string }) => item.slug === 'broken-anchor');

    expect(response.status).toBe(200);
    expect(candidate.renderMetadata).toBeNull();
    expect(candidate.renderMetadataErrors[0]).toContain('mount');
  });
});
