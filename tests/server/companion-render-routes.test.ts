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
import { GET as getCompanionAnimatedRenderRoute } from '@/app/api/companion/render-animated/route';
import { GET as getCompanionRenderRoute } from '@/app/api/companion/render/route';
import { GET as getDevLoginRoute } from '@/app/auth/dev-login/route';
import { createCompanionItem } from '@/lib/server/companion';

function svgBuffer(fill = '#7c5cff') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`,
    'utf8',
  );
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
