import { getDatabase } from '@/lib/server/database';

export function getAuthDb() {
  return getDatabase();
}
