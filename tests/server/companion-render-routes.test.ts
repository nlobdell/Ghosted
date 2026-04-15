import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
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

import { GET as getCompanionAssetRoute } from '@/app/api/companion/assets/[...path]/route';
import { POST as postCompanionAdminBaseRoute } from '@/app/api/companion/admin/base/route';
import { GET as getCompanionAnimatedRenderRoute } from '@/app/api/companion/render-animated/route';
import { GET as getCompanionDiscordGifRoute } from '@/app/api/companion/render-discord-animated.gif/route';
import { GET as getCompanionRenderRoute } from '@/app/api/companion/render/route';
import { GET as getDevLoginRoute } from '@/app/auth/dev-login/route';
import { createCompanionItem } from '@/lib/server/companion';
import { companionRenderManifest } from '@/lib/server/companion-storage';
import { saveUserGameAccount } from '@/lib/server/wom';
import { PLAYER, installWomFetchMock } from './wom-fixtures';

function svgBuffer(fill = '#7c5cff') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`,
    'utf8',
  );
}

function ghostlingMetadata(sceneFacingFlip?: 'allow' | 'ignore' | 'invert') {
  return JSON.stringify({
    kind: 'ghostling-cosmetic',
    schemaVersion: 1,
    slot: 'hat',
    ...(sceneFacingFlip ? { sceneFacingFlip } : {}),
    canvas: { width: 210, height: 260 },
    baseRect: { x: 0, y: 21, width: 210, height: 210 },
    mount: { x: 105, y: 140 },
    pieces: {
      front: {
        docRect: { x: 96, y: 10, width: 16, height: 12 },
      },
    },
  });
}

function getUser(context: ServerTestContext, userId: number) {
  return context.db.prepare(`
    SELECT id, username, global_name
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; username: string; global_name: string | null };
}

function seedCompanionItem(
  context: ServerTestContext,
  actorId: number,
  options: { name: string; slot: string; fill?: string },
) {
  return createCompanionItem(context.db, getUser(context, actorId), {
    name: options.name,
    slot: options.slot,
    rarity: 'common',
    cost: 0,
    description: '',
    frontAsset: {
      filename: `${options.name.toLowerCase().replaceAll(/\s+/g, '-')}-front.svg`,
      contentType: 'image/svg+xml',
      data: svgBuffer(options.fill),
    },
  });
}

describe('companion render and dev-login routes', () => {
  let context: ServerTestContext;

  beforeEach(() => {
    context = setupServerTestEnvironment();
    authMock.mockReset();
    cookiesMock.mockReset();
    authMock.mockResolvedValue(null);
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('serves uploaded companion assets with the correct mime type and no-store caching', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat' });
    const assetPath = context.db.prepare(`
      SELECT front_asset_path
      FROM companion_catalog
      WHERE slug = 'moon-hood'
    `).get() as { front_asset_path: string };

    const response = await getCompanionAssetRoute(
      new Request('http://localhost/api/companion/assets'),
      { params: Promise.resolve({ path: assetPath.front_asset_path.split('/') }) },
    );
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toContain('<svg');
  });

  it('returns 404 for invalid and missing asset paths', async () => {
    const invalidResponse = await getCompanionAssetRoute(
      new Request('http://localhost/api/companion/assets'),
      { params: Promise.resolve({ path: ['..', 'nope.svg'] }) },
    );
    const invalidPayload = await invalidResponse.json();

    expect(invalidResponse.status).toBe(404);
    expect(invalidPayload).toEqual({ error: 'Companion asset not found.' });

    const missingResponse = await getCompanionAssetRoute(
      new Request('http://localhost/api/companion/assets'),
      { params: Promise.resolve({ path: ['uploads', 'items', 'missing.svg'] }) },
    );
    const missingPayload = await missingResponse.json();

    expect(missingResponse.status).toBe(404);
    expect(missingPayload).toEqual({ error: 'Companion asset not found.' });
  });

  it('renders preview SVGs for the current user without requiring caller changes', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat' });

    const response = await getCompanionRenderRoute(new Request('http://localhost/api/companion/render?preview=moon-hood'));
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(payload).toContain('<svg');
    expect(payload).toContain('data:image/svg+xml;base64');
  });

  it('renders raster PNGs when the static companion format=png variant is requested', async () => {
    const response = await getCompanionRenderRoute(new Request('http://localhost/api/companion/render?base=1&format=png'));
    const payload = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(payload.length).toBeGreaterThan(128);
  });

  it('preserves the layered head fallback for body-only base uploads across static and animated renders', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const formData = new FormData();
    formData.set('bodyAsset', new File([svgBuffer('#22cc88')], 'ghostling-base-body.svg', { type: 'image/svg+xml' }));

    const uploadResponse = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: formData,
    }));
    expect(uploadResponse.status).toBe(201);

    authMock.mockResolvedValue(null);
    const staticResponse = await getCompanionRenderRoute(new Request('http://localhost/api/companion/render?base=1'));
    const staticPayload = await staticResponse.text();
    expect(staticResponse.status).toBe(200);
    expect(staticPayload).toContain('data:image/svg+xml;base64');
    expect(staticPayload.match(/data:image\/png;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    const animatedResponse = await getCompanionAnimatedRenderRoute(new Request('http://localhost/api/companion/render-animated?base=1'));
    const animatedPayload = await animatedResponse.text();
    expect(animatedResponse.status).toBe(200);
    expect(animatedPayload).toContain('data:image/svg+xml;base64');
    expect(animatedPayload.match(/data:image\/png;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('uses explicit head overrides instead of the default head fallback when both base layers are uploaded', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    authMock.mockResolvedValue({ user: { id: String(adminId) } });

    const formData = new FormData();
    formData.set('bodyAsset', new File([svgBuffer('#3366ff')], 'ghostling-base-body.svg', { type: 'image/svg+xml' }));
    formData.set('headAsset', new File([svgBuffer('#ff66aa')], 'ghostling-base-head.svg', { type: 'image/svg+xml' }));

    const uploadResponse = await postCompanionAdminBaseRoute(new Request('http://localhost/api/companion/admin/base', {
      method: 'POST',
      body: formData,
    }));
    expect(uploadResponse.status).toBe(201);

    authMock.mockResolvedValue(null);
    const staticResponse = await getCompanionRenderRoute(new Request('http://localhost/api/companion/render?base=1'));
    const staticPayload = await staticResponse.text();
    expect(staticResponse.status).toBe(200);
    expect(staticPayload.match(/data:image\/svg\+xml;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(staticPayload.match(/data:image\/png;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

    const animatedResponse = await getCompanionAnimatedRenderRoute(new Request('http://localhost/api/companion/render-animated?base=1'));
    const animatedPayload = await animatedResponse.text();
    expect(animatedResponse.status).toBe(200);
    expect(animatedPayload.match(/data:image\/svg\+xml;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(animatedPayload.match(/data:image\/png;base64/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('renders companion SVGs by both internal user id and Discord id', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { discordId: 'member-123', username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });
    seedCompanionItem(context, adminId, { name: 'Moon Hood', slot: 'hat' });
    context.db.prepare(`
      INSERT INTO user_companion_inventory (user_id, item_slug, unlocked_at)
      VALUES (?, 'moon-hood', datetime('now'))
    `).run(userId);
    context.db.prepare(`
      INSERT INTO user_companion_loadout (user_id, hat_item_slug, face_item_slug, neck_item_slug, body_item_slug, updated_at)
      VALUES (?, 'moon-hood', NULL, NULL, NULL, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET hat_item_slug = 'moon-hood', updated_at = datetime('now')
    `).run(userId);

    const byIdResponse = await getCompanionRenderRoute(new Request(`http://localhost/api/companion/render?user=${userId}`));
    const byIdPayload = await byIdResponse.text();
    expect(byIdResponse.status).toBe(200);
    expect(byIdPayload).toContain('<svg');

    const byDiscordResponse = await getCompanionRenderRoute(new Request('http://localhost/api/companion/render?user=member-123'));
    const byDiscordPayload = await byDiscordResponse.text();
    expect(byDiscordResponse.status).toBe(200);
    expect(byDiscordPayload).toContain('<svg');
  });

  it('keeps manifest, static SVG, and animated SVG bounds aligned for metadata-positioned cosmetics', async () => {
    const adminId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { discordId: 'anchor-member', username: 'member', globalName: 'Member' });
    authMock.mockResolvedValue({ user: { id: String(userId) } });

    createCompanionItem(context.db, getUser(context, adminId), {
      name: 'Sky Crown',
      slot: 'hat',
      rarity: 'common',
      cost: 0,
      description: '',
      metadataJson: ghostlingMetadata('ignore'),
      frontAsset: {
        filename: 'sky-crown-front.svg',
        contentType: 'image/svg+xml',
        data: svgBuffer('#66d9ff'),
      },
    });

    context.db.prepare(`
      INSERT INTO user_companion_inventory (user_id, item_slug, unlocked_at)
      VALUES (?, 'sky-crown', datetime('now'))
    `).run(userId);
    context.db.prepare(`
      INSERT INTO user_companion_loadout (user_id, hat_item_slug, face_item_slug, neck_item_slug, body_item_slug, updated_at)
      VALUES (?, 'sky-crown', NULL, NULL, NULL, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET hat_item_slug = 'sky-crown', updated_at = datetime('now')
    `).run(userId);

    const manifest = companionRenderManifest(context.db, {
      hat: 'sky-crown',
      face: null,
      neck: null,
      body: null,
    });

    expect(manifest.height).toBeGreaterThan(32);
    expect(manifest.layers.find((layer) => layer.key === 'hat-front')?.slices?.[0]?.targetY ?? -1).toBeGreaterThanOrEqual(0);
    expect(manifest.layers.find((layer) => layer.key === 'hat-front')?.sceneFacingFlip).toBe('ignore');
    expect(manifest.layers.filter((layer) => layer.slot == null).every((layer) => layer.sceneFacingFlip === 'allow')).toBe(true);

    const staticResponse = await getCompanionRenderRoute(new Request(`http://localhost/api/companion/render?user=${userId}`));
    const staticPayload = await staticResponse.text();
    expect(staticResponse.status).toBe(200);
    const staticViewBox = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(staticPayload);
    expect(staticViewBox).not.toBeNull();
    const staticWidth = Number(staticViewBox?.[1] ?? 0);
    const staticHeight = Number(staticViewBox?.[2] ?? 0);
    expect(staticWidth).toBeGreaterThan(0);
    expect(staticHeight).toBeGreaterThan(32);
    expect(manifest.width / staticWidth).toBeCloseTo(manifest.height / staticHeight, 1);

    const animatedResponse = await getCompanionAnimatedRenderRoute(new Request(`http://localhost/api/companion/render-animated?user=${userId}`));
    const animatedPayload = await animatedResponse.text();
    expect(animatedResponse.status).toBe(200);
    const animatedViewBox = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(animatedPayload);
    expect(animatedViewBox).not.toBeNull();
    const animatedWidth = Number(animatedViewBox?.[1] ?? 0);
    const animatedHeight = Number(animatedViewBox?.[2] ?? 0);
    expect(animatedWidth).toBeGreaterThan(0);
    expect(animatedHeight).toBeGreaterThan(32);
    expect(manifest.width / animatedWidth).toBeCloseTo(manifest.height / animatedHeight, 1);
  });

  it('renders animated card variants and preserves 404 behavior for missing previews', async () => {
    const response = await getCompanionAnimatedRenderRoute(
      new Request('http://localhost/api/companion/render-animated?card=1'),
    );
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(payload).toContain('width="480"');
    expect(payload).toContain('<svg');

    const missingResponse = await getCompanionAnimatedRenderRoute(
      new Request('http://localhost/api/companion/render-animated?preview=missing-item'),
    );
    const missingPayload = await missingResponse.json();

    expect(missingResponse.status).toBe(404);
    expect(missingPayload).toEqual({ error: 'Preview item not found.' });
  });

  it('renders Discord card variants at wide-card dimensions with WOM rank and tracked stats', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    installWomFetchMock();

    const response = await getCompanionAnimatedRenderRoute(
      new Request(`http://localhost/api/companion/render-animated?user=${userId}&card=1&discord=1`),
    );
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(payload).toContain('width="1200"');
    expect(payload).toContain('height="630"');
    expect(payload).toContain('Event Captain');
    expect(payload).toContain('Total EXP');
    expect(payload).toContain('432.1');
    expect(payload).toContain('Competitions');
    const stageTransform = /<g transform="translate\(([0-9.]+) ([0-9.]+)\) scale\(([0-9.]+)\)">/.exec(payload);
    expect(stageTransform).not.toBeNull();
    expect(Number(stageTransform?.[1] ?? 0)).toBeGreaterThan(60);
    expect(Number(stageTransform?.[2] ?? 0)).toBeGreaterThan(180);
  });

  it('renders a Discord-pasteable animated GIF card', async () => {
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    saveUserGameAccount(context.db, userId, 'osrs', PLAYER);
    installWomFetchMock();

    const response = await getCompanionDiscordGifRoute(
      new Request(`http://localhost/api/companion/render-discord-animated.gif?user=${userId}`),
    );
    const payload = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/gif');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(payload.length).toBeGreaterThan(1024);
  });

  it('returns 404 when dev auth is disabled', async () => {
    const response = await getDevLoginRoute(new Request('http://localhost/auth/dev-login?next=/admin/'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Development auth is disabled.' });
  });

  it('creates a legacy dev session, honors admin flags, and redirects to the requested path', async () => {
    process.env.ENABLE_DEV_AUTH = 'true';

    const response = await getDevLoginRoute(
      new Request('http://localhost/auth/dev-login?discordId=dev-admin&name=ghosted-dev&role=member&role=mod&admin=1&next=/admin/'),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost/admin/');
    expect(response.headers.get('set-cookie') ?? '').toContain('ghosted_session=');

    const row = context.db.prepare(`
      SELECT id, discord_id, username, global_name, roles_json, is_admin
      FROM users
      WHERE discord_id = 'dev-admin'
    `).get() as {
      id: number;
      discord_id: string;
      username: string;
      global_name: string | null;
      roles_json: string;
      is_admin: number;
    };
    const sessionRow = context.db.prepare(`
      SELECT token, user_id
      FROM sessions
      WHERE user_id = ?
    `).get(row.id) as { token: string; user_id: number } | undefined;

    expect(row.username).toBe('ghosted-dev');
    expect(row.global_name).toBe('Ghosted-Dev');
    expect(JSON.parse(row.roles_json)).toEqual(['member', 'mod']);
    expect(row.is_admin).toBe(1);
    expect(sessionRow?.token).toBeTruthy();
  });
});
