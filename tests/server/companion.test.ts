import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerTestContext } from './test-utils';
import { addRewardLedgerEntry, cleanupServerTestEnvironment, insertUser, setupServerTestEnvironment } from './test-utils';
import {
  buildCompanionPayload,
  buildHallCompanionSummaryPayload,
  createCompanionItem,
  equipCompanionItem,
  purchaseCompanionItem,
} from '@/lib/server/companion';
import {
  COMPANION_DEFAULT_BASE_ASSET_PATH,
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

  beforeEach(() => {
    context = setupServerTestEnvironment();
  });

  afterEach(() => {
    cleanupServerTestEnvironment(context);
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
    expect(payload.share.discordCardUrl).toContain('card=1&discord=1');
    expect(payload.share.animatedDiscordCardUrl).toContain('card=1&discord=1');
    expect(hallSummary.renderManifest.width).toBe(70);
    expect(hallSummary.renderManifest.height).toBe(70);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-right-hand.png'))).toBe(true);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-left-hand.png'))).toBe(true);
    expect(hallSummary.renderManifest.layers.some((layer) => layer.src.includes('ghostling-base-head.png'))).toBe(true);
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
});
