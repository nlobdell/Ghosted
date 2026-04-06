import 'server-only';

import type { Database } from 'better-sqlite3';
import { jsonLoad, utcIso } from '@/lib/server/core';

export function getBalance(db: Database, userId: number) {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM reward_ledger WHERE user_id = ?')
    .get(userId) as { balance: number };
  return Number(row.balance ?? 0);
}

export function appendRewardLedger(
  db: Database,
  userId: number,
  amount: number,
  entryType: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  db.prepare(`
    INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, amount, entryType, description, JSON.stringify(metadata ?? {}), utcIso());
}

export function recentLedger(db: Database, userId: number, limit = 25) {
  const rows = db.prepare(`
    SELECT id, amount, entry_type, description, metadata_json, created_at
    FROM reward_ledger
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, limit) as Array<{
    id: number;
    amount: number;
    entry_type: string;
    description: string;
    metadata_json: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    entryType: row.entry_type,
    description: row.description,
    metadata: jsonLoad<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: row.created_at,
  }));
}
