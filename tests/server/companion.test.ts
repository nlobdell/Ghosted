import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import {
  archiveCompanionItem,
  buildCompanionAdminPayload,
  buildCompanionPayload,
  buildHallCompanionSummaryPayload,
  createCompanionItem,
  deleteCompanionItem,
  equipCompanionItem,
  purchaseCompanionItem,
  restoreCompanionItem,
  updateCompanionItem,
} from '@/lib/server/companion';
import {
  COMPANION_DEFAULT_BASE_ASSET_PATH,
  companionAssetPath,
  companionAssetDir,
  repoCompanionImportCandidates,
} from '@/lib/server/companion-storage';

function getUser(context: ServerTestContext, userId: number) {
  return context.db.prepare(`
    SELECT id, username, global_name
    FROM users
    WHERE id = ?
  `).get(userId) as { id: number; username: string; global_name: string | null };
}

function svgAsset(filename: string, fill = '#7c5cff') {
  return {
    filename,
    contentType: 'image/svg+xml',
    data: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/></svg>`,
      'utf8',
    ),
  };
}

describe('companion server module', () => {
  let context: ServerTestContext;
  let repoFixturePaths: string[];

  beforeEach(() => {
    context = setupServerTestEnvironment();
    repoFixturePaths = [];
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
    for (const fixturePath of repoFixturePaths) {
      fs.rmSync(fixturePath, { force: true });
    }
  });

  it('starts with a default base asset and no seeded cosmetics', () => {
    const userId = insertUser(context.db);
    const payload = buildCompanionPayload(context.db, getUser(context, userId));
    const hallSummary = buildHallCompanionSummaryPayload(context.db, getUser(context, userId));
    const baseRow = context.db.prepare(`
      SELECT base_asset_path, base_head_asset_path
      FROM companion_settings
      WHERE singleton_key = 'default'
    `).get() as { base_asset_path: string; base_head_asset_path: string | null };
    const countRow = context.db.prepare('SELECT COUNT(*) AS count FROM companion_catalog').get() as { count: number };

    expect(baseRow.base_asset_path).toBe(COMPANION_DEFAULT_BASE_ASSET_PATH);
    expect(baseRow.base_head_asset_path).toBeNull();
    expect(countRow.count).toBe(0);
    expect(payload.items).toEqual([]);
    expect(payload.baseAssetUrl).toContain('ghostling-base-body.png');
    expect(payload.renderManifest.width).toBe(70);
    expect(payload.renderManifest.height).toBe(70);
    expect(payload.renderManifest.layers.map((layer) => layer.role)).toEqual([
      'base-right-hand',
      'base-body',
      'base-left-hand',
      'base-head',
    ]);
    expect(payload.renderManifest.layers[0]?.src).toContain('ghostling-base-right-hand.png');
    expect(payload.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
    expect(payload.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-body.png'))).toBe(true);
    expect(payload.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-head.png'))).toBe(true);
    expect(payload.renderManifest.layers.every((layer) => layer.sceneFacingFlip === 'allow')).toBe(true);
    expect(payload.share.discordCardUrl).toContain('card=1&discord=1');
    expect(payload.share.animatedDiscordCardUrl).toContain('card=1&discord=1');
    expect(payload.share.animatedDiscordEmbedUrl).toContain('/api/companion/render-discord-animated.gif?user=');
    expect(hallSummary.renderManifest.width).toBe(70);
    expect(hallSummary.renderManifest.height).toBe(70);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-right-hand.png'))).toBe(true);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-head.png'))).toBe(true);
    expect(hallSummary.renderManifest.layers.every((layer) => layer.sceneFacingFlip === 'allow')).toBe(true);
  });

  it('purchases a cosmetic, deducts points, and auto-equips the first unlocked slot item', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    addRewardLedgerEntry(context.db, userId, 250, 'welcome_bonus', 'Initial points');

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'rare',
      cost: 120,
      description: 'Night market hood.',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });

    const payload = purchaseCompanionItem(context.db, getUser(context, userId), 'moon-hood');
    const inventoryRow = context.db.prepare(`
      SELECT item_slug
      FROM user_companion_inventory
      WHERE user_id = ? AND item_slug = ?
    `).get(userId, 'moon-hood') as { item_slug: string } | undefined;
    const ledgerRows = context.db.prepare(`
      SELECT entry_type, amount
      FROM reward_ledger
      WHERE user_id = ?
      ORDER BY id ASC
    `).all(userId) as Array<{ entry_type: string; amount: number }>;

    expect(payload.balance).toBe(130);
    expect(payload.ownedCount).toBe(1);
    expect(payload.equippedCount).toBe(1);
    expect(payload.loadout.hat).toBe('moon-hood');
    expect(inventoryRow?.item_slug).toBe('moon-hood');
    expect(ledgerRows).toEqual([
      { entry_type: 'welcome_bonus', amount: 250 },
      { entry_type: 'companion_purchase', amount: -120 },
    ]);
  });

  it('rejects missing, unowned, and wrong-slot equips', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'common',
      cost: 10,
      description: '',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Silver Visor',
      slot: 'face',
      rarity: 'common',
      cost: 10,
      description: '',
      frontAsset: svgAsset('silver-visor-front.svg', '#57b8ff'),
    });

    expect(() => equipCompanionItem(context.db, getUser(context, userId), 'hat', 'missing-slug')).toThrowError(
      'That companion item does not exist.',
    );
    expect(() => equipCompanionItem(context.db, getUser(context, userId), 'hat', 'silver-visor')).toThrowError(
      'That cosmetic does not fit the selected slot.',
    );
    expect(() => equipCompanionItem(context.db, getUser(context, userId), 'hat', 'moon-hood')).toThrowError(
      'Unlock the cosmetic before equipping it.',
    );
  });

  it('keeps owned or equipped inactive cosmetics visible while hiding inactive unowned ones', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    addRewardLedgerEntry(context.db, userId, 300, 'welcome_bonus', 'Initial points');

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'rare',
      cost: 100,
      description: '',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Shadow Cloak',
      slot: 'body',
      rarity: 'epic',
      cost: 200,
      description: '',
      frontAsset: svgAsset('shadow-cloak-front.svg', '#111111'),
    });

    purchaseCompanionItem(context.db, getUser(context, userId), 'moon-hood');
    context.db.prepare('UPDATE companion_catalog SET active = 0 WHERE slug = ?').run('moon-hood');
    context.db.prepare('UPDATE companion_catalog SET active = 0 WHERE slug = ?').run('shadow-cloak');

    const payload = buildCompanionPayload(context.db, getUser(context, userId));
    const ownedItem = payload.items.find((item) => item.slug === 'moon-hood');
    const hiddenItem = payload.items.find((item) => item.slug === 'shadow-cloak');

    expect(ownedItem).toMatchObject({
      slug: 'moon-hood',
      active: false,
      owned: true,
      equipped: true,
    });
    expect(hiddenItem).toBeUndefined();
  });

  it('resolves the companion asset directory from the explicit asset dir and database fallback', () => {
    expect(companionAssetDir()).toBe(path.resolve(process.env.COMPANION_ASSET_DIR ?? ''));

    delete process.env.COMPANION_ASSET_DIR;
    const databasePath = path.join(context.tempDir, 'state', 'ghosted.db');
    process.env.DATABASE_PATH = databasePath;

    expect(companionAssetDir()).toBe(path.join(path.dirname(databasePath), 'companion-assets'));
  });

  it('returns no repo import candidates when repo defaults items are absent', () => {
    expect(repoCompanionImportCandidates(context.db)).toEqual([]);
  });

  it('renames cosmetics transactionally, keeps owned archived renders intact, and blocks new archived purchases', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const ownerId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    const shopperId = insertUser(context.db, { username: 'shopper', globalName: 'Shopper' });
    addRewardLedgerEntry(context.db, ownerId, 400, 'welcome_bonus', 'Initial points');
    addRewardLedgerEntry(context.db, shopperId, 400, 'welcome_bonus', 'Initial points');

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'rare',
      cost: 120,
      description: 'Night market hood.',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });

    purchaseCompanionItem(context.db, getUser(context, ownerId), 'moon-hood');

    const renamedLibrary = updateCompanionItem(context.db, getUser(context, actorId), 'moon-hood', {
      name: 'Sun Hood',
      slug: 'sun-hood',
      rarity: 'legendary',
      cost: 180,
      description: 'Solar market hood.',
      metadataJson: null,
    });
    const inventoryRow = context.db.prepare(`
      SELECT item_slug
      FROM user_companion_inventory
      WHERE user_id = ?
    `).get(ownerId) as { item_slug: string };
    const loadoutRow = context.db.prepare(`
      SELECT hat_item_slug
      FROM user_companion_loadout
      WHERE user_id = ?
    `).get(ownerId) as { hat_item_slug: string | null };

    expect(renamedLibrary.items.find((item) => item.slug === 'sun-hood')).toMatchObject({
      name: 'Sun Hood',
      rarity: 'legendary',
      cost: 180,
    });
    expect(renamedLibrary.items.find((item) => item.slug === 'moon-hood')).toBeUndefined();
    expect(inventoryRow.item_slug).toBe('sun-hood');
    expect(loadoutRow.hat_item_slug).toBe('sun-hood');

    const archivedLibrary = archiveCompanionItem(context.db, getUser(context, actorId), 'sun-hood');
    const ownerPayload = buildCompanionPayload(context.db, getUser(context, ownerId));

    expect(archivedLibrary.items.find((item) => item.slug === 'sun-hood')).toBeUndefined();
    expect(archivedLibrary.archivedItems.find((item) => item.slug === 'sun-hood')).toMatchObject({
      state: 'archived',
      archived: true,
      active: false,
    });
    expect(ownerPayload.items.find((item) => item.slug === 'sun-hood')).toMatchObject({
      slug: 'sun-hood',
      archived: true,
      owned: true,
      equipped: true,
      active: false,
    });
    expect(() => purchaseCompanionItem(context.db, getUser(context, shopperId), 'sun-hood')).toThrowError(
      'That companion cosmetic is archived and cannot be unlocked right now.',
    );

    const restoredLibrary = restoreCompanionItem(context.db, getUser(context, actorId), 'sun-hood');
    expect(restoredLibrary.archivedItems.find((item) => item.slug === 'sun-hood')).toBeUndefined();
    expect(restoredLibrary.items.find((item) => item.slug === 'sun-hood')).toMatchObject({
      state: 'visible',
      active: true,
      archived: false,
    });
  });

  it('separates visible, hidden, and archived cosmetics in the admin library payload', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'common',
      cost: 0,
      description: '',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Silver Veil',
      slot: 'face',
      rarity: 'rare',
      cost: 0,
      description: '',
      frontAsset: svgAsset('silver-veil-front.svg', '#57b8ff'),
    });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Ember Cape',
      slot: 'body',
      rarity: 'epic',
      cost: 0,
      description: '',
      frontAsset: svgAsset('ember-cape-front.svg', '#ff8855'),
    });

    context.db.prepare('UPDATE companion_catalog SET active = 0 WHERE slug = ?').run('silver-veil');
    archiveCompanionItem(context.db, getUser(context, actorId), 'ember-cape');

    const library = buildCompanionAdminPayload(context.db);

    expect(library.items.find((item) => item.slug === 'moon-hood')).toMatchObject({ state: 'visible', archived: false });
    expect(library.items.find((item) => item.slug === 'silver-veil')).toMatchObject({ state: 'hidden', archived: false });
    expect(library.items.find((item) => item.slug === 'ember-cape')).toBeUndefined();
    expect(library.archivedItems.find((item) => item.slug === 'ember-cape')).toMatchObject({ state: 'archived', archived: true });
  });

  it('hard deletes archived cosmetics, purges member refs, and removes safe uploaded files', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    const userId = insertUser(context.db, { username: 'member', globalName: 'Member' });
    addRewardLedgerEntry(context.db, userId, 250, 'welcome_bonus', 'Initial points');

    const created = createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'rare',
      cost: 120,
      description: 'Night market hood.',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });
    const item = created.items.find((entry) => entry.slug === 'moon-hood');
    expect(item?.frontAssetPath).toContain('uploads/items/');
    expect(fs.existsSync(companionAssetPath(String(item?.frontAssetPath)))).toBe(true);

    purchaseCompanionItem(context.db, getUser(context, userId), 'moon-hood');
    archiveCompanionItem(context.db, getUser(context, actorId), 'moon-hood');

    const result = deleteCompanionItem(context.db, getUser(context, actorId), 'moon-hood');
    const inventoryCount = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM user_companion_inventory
      WHERE item_slug = 'moon-hood'
    `).get() as { count: number };
    const loadoutRow = context.db.prepare(`
      SELECT hat_item_slug
      FROM user_companion_loadout
      WHERE user_id = ?
    `).get(userId) as { hat_item_slug: string | null };

    expect(result.warning).toBeNull();
    expect(result.library.archivedItems.find((entry) => entry.slug === 'moon-hood')).toBeUndefined();
    expect(result.library.recentAudit[0]?.action).toBe('delete_companion_item');
    expect(inventoryCount.count).toBe(0);
    expect(loadoutRow.hat_item_slug).toBeNull();
    expect(fs.existsSync(companionAssetPath(String(item?.frontAssetPath)))).toBe(false);
  });

  it('rejects deleting missing or non-archived cosmetics', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'common',
      cost: 0,
      description: '',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });

    expect(() => deleteCompanionItem(context.db, getUser(context, actorId), 'missing-slug')).toThrowError(
      'That companion cosmetic does not exist.',
    );
    expect(() => deleteCompanionItem(context.db, getUser(context, actorId), 'moon-hood')).toThrowError(
      'Archive the cosmetic before permanently deleting it.',
    );
  });

  it('keeps shared upload files and repo files when archived cosmetics are hard-deleted', () => {
    const actorId = insertUser(context.db, { username: 'admin', globalName: 'Admin', isAdmin: 1 });

    const firstLibrary = createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Moon Hood',
      slot: 'hat',
      rarity: 'common',
      cost: 0,
      description: '',
      frontAsset: svgAsset('moon-hood-front.svg'),
    });
    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Silver Veil',
      slot: 'face',
      rarity: 'rare',
      cost: 0,
      description: '',
      frontAsset: svgAsset('silver-veil-front.svg', '#57b8ff'),
    });
    const sharedAssetPath = String(firstLibrary.items.find((item) => item.slug === 'moon-hood')?.frontAssetPath ?? '');
    context.db.prepare(`
      UPDATE companion_catalog
      SET front_asset_path = ?
      WHERE slug = 'silver-veil'
    `).run(sharedAssetPath);

    archiveCompanionItem(context.db, getUser(context, actorId), 'moon-hood');
    const sharedDelete = deleteCompanionItem(context.db, getUser(context, actorId), 'moon-hood');

    expect(sharedDelete.warning).toBeNull();
    expect(fs.existsSync(companionAssetPath(sharedAssetPath))).toBe(true);

    const repoItemsDir = path.join(process.cwd(), 'assets', 'companion', 'defaults', 'items');
    fs.mkdirSync(repoItemsDir, { recursive: true });
    const repoAssetName = `delete-guard-${Date.now()}.svg`;
    const repoAssetPath = path.join(repoItemsDir, repoAssetName);
    repoFixturePaths.push(repoAssetPath);
    fs.writeFileSync(repoAssetPath, svgAsset(repoAssetName, '#ffaa55').data);

    createCompanionItem(context.db, getUser(context, actorId), {
      name: 'Repo Cape',
      slot: 'body',
      rarity: 'epic',
      cost: 0,
      description: '',
      frontAsset: svgAsset('repo-cape-front.svg', '#ffaa55'),
    });
    context.db.prepare(`
      UPDATE companion_catalog
      SET front_asset_path = ?
      WHERE slug = 'repo-cape'
    `).run(`repo/defaults/items/${repoAssetName}`);

    archiveCompanionItem(context.db, getUser(context, actorId), 'repo-cape');
    const repoDelete = deleteCompanionItem(context.db, getUser(context, actorId), 'repo-cape');

    expect(repoDelete.warning).toBeNull();
    expect(fs.existsSync(repoAssetPath)).toBe(true);
  });
});
