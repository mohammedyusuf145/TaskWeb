/**
 * Attachments: bytes are stored locally first (IndexedDB) so they work offline and in demo mode,
 * then uploaded to the private Supabase Storage bucket when online.
 * Path layout (enforced by storage policies): <user_id>/<card_id>/<attachment_id>-<safe name>
 */
import { getDb, getUserId } from '@/lib/db';
import { newId, softDelete, upsert } from '@/lib/db/repo';
import { registerSyncTask, syncNow } from '@/lib/db/sync';
import { supabase } from '@/lib/supabase';
import type { Attachment } from '@/types/database';

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const BUCKET = 'attachments';

/** Must match the bucket's allowed_mime_types (migration 0003). */
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const ALLOWED = new Set(Object.values(EXT_TO_MIME));
export const ACCEPT = Object.keys(EXT_TO_MIME)
  .map((e) => `.${e}`)
  .join(',');

export type AttachmentError = 'type' | 'size' | 'empty';

/** Resolve a trustworthy MIME type (browsers sometimes leave it empty) and validate size. */
export function validateFile(file: { name: string; type: string; size: number }): { mime: string } | { error: AttachmentError } {
  if (file.size === 0) return { error: 'empty' };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: 'size' };
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExt = EXT_TO_MIME[ext];
  const mime = file.type && ALLOWED.has(file.type) ? file.type : byExt;
  // Extension and declared type must agree on the family, so "photo.pdf" with type image/png is refused.
  if (!mime || !byExt || mime.split('/')[0] !== byExt.split('/')[0]) return { error: 'type' };
  return { mime };
}

/** ASCII-only storage key; the original name is kept in the row for display. */
export function safeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'file';
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base}.${ext}` : base;
}

export async function addAttachment(cardId: string, file: File): Promise<Attachment | AttachmentError> {
  const v = validateFile(file);
  if ('error' in v) return v.error;
  const id = newId();
  const path = `${getUserId()}/${cardId}/${id}-${safeName(file.name)}`;
  await getDb().files.put({ id, blob: file, uploaded: 0 });
  const row = await upsert('attachments', { id, card_id: cardId, storage_path: path, name: file.name.slice(0, 255), mime: v.mime, size_bytes: file.size });
  void syncNow(); // uploads right away when online
  return row;
}

export async function removeAttachment(att: Attachment) {
  await softDelete('attachments', [att.id]);
  await getDb().files.delete(att.id);
  if (supabase) void supabase.storage.from(BUCKET).remove([att.storage_path]);
}

/** Object URL for viewing: local bytes if we have them, otherwise a short-lived signed URL. */
export async function attachmentUrl(att: Attachment): Promise<string | null> {
  const local = await getDb().files.get(att.id);
  if (local) return URL.createObjectURL(local.blob);
  if (!supabase) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 300);
  return data?.signedUrl ?? null;
}

export async function openAttachment(att: Attachment) {
  // Open the tab synchronously so popup blockers allow it, then point it at the file.
  const win = window.open('', '_blank');
  const url = await attachmentUrl(att);
  if (!url) return win?.close();
  if (win) {
    win.opener = null;
    win.location.href = url;
  } else {
    window.location.href = url;
  }
}

/** Uploads any local files not yet in Storage. Registered as a post-sync task. */
registerSyncTask(async (client) => {
  const db = getDb();
  const pending = await db.files.where('uploaded').equals(0).toArray();
  for (const f of pending) {
    const att = await db.attachments.get(f.id);
    if (!att || att.deleted_at) {
      await db.files.delete(f.id);
      continue;
    }
    const { error } = await client.storage.from(BUCKET).upload(att.storage_path, f.blob, { contentType: att.mime, upsert: true });
    if (!error) await db.files.update(f.id, { uploaded: 1 });
  }
});

export function formatBytes(n: number, lang: 'ar' | 'en'): string {
  const units = lang === 'ar' ? ['بايت', 'ك.ب', 'م.ب'] : ['B', 'KB', 'MB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
