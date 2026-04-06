import 'server-only';

import { getDatabase } from '@/lib/server/database';
import { utcIso } from '@/lib/server/core';

export function recordAudit(
  actorUserId: number | null,
  action: string,
  targetType: string,
  targetId: string,
  payload?: Record<string, unknown>,
) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO audit_log (actor_user_id, action, target_type, target_id, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorUserId, action, targetType, targetId, JSON.stringify(payload ?? {}), utcIso());
}
