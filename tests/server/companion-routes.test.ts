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
import { POST as postCompanionPurchaseRoute } from '@/app/api/companion/purchase/route';
import { POST as postCompanionEquipRoute } from '@/app/api/companion/equip/route';
import { POST as postCompanionAdminBaseRoute } from '@/app/api/companion/admin/base/route';
import { POST as postCompanionAdminImportRepoRoute } from '@/app/api/companion/admin/items/import-repo/route';
import { POST as postCompanionAdminItemsRoute } from '@/app/api/companion/admin/items/route';
import { POST as postCompanionAdminReorderRoute } from '@/app/api/companion/admin/items/reorder/route';
import { POST as postCompanionAdminReplaceAssetsRoute } from '@/app/api/companion/admin/items/replace-assets/route';
import { POST as postCompanionAdminVisibilityRoute } from '@/app/api/companion/admin/items/visibility/route';
import { GET as getCompanionAdminLibraryRoute } from '@/app/api/companion/admin/library/route';
import { createCompanionItem } from '@/lib/server/companion';

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

    const memberId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(memberId) } });

    const forbiddenResponse = await getCompanionAdminLibraryRoute();
    const forbiddenPayload = await forbiddenResponse.json();

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenPayload).toEqual({ error: 'You do not have access to admin tools.' });
  });

  it('accepts multipart base uploads and returns the updated envelope', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });
    const formData = new FormData();
    formData.set('asset', svgFile('ghostling-base.svg', '#22cc88'));

    const response = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: formData,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe('Companion base updated.');
    expect(payload.library.base.assetPath).toContain('uploads/base/');
    expect(payload.companion.baseAssetUrl).toContain('uploads/base/');
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
});
