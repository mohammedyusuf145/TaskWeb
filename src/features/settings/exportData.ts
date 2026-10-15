import { SYNCED_TABLES } from '@/types/database';
import { getDb } from '@/lib/db';

/** Download every row the user owns (including soft-deleted ones) as one JSON file. */
export async function exportAllData() {
  const db = getDb();
  const data: Record<string, unknown[]> = {};
  for (const name of SYNCED_TABLES) data[name] = await db[name].toArray();
  const blob = new Blob([JSON.stringify({ app: 'mizan', version: 1, exported_at: new Date().toISOString(), data }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mizan-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
