// Permanently deletes the calling user's account, files and data.
// Rows are removed by ON DELETE CASCADE from auth.users; storage files are removed here first.

import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { adminClient, getUser } from '../_shared/auth.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';

const BUCKET = 'attachments';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return error(req, 405, 'method_not_allowed');

  const auth = await getUser(req);
  if (!auth) return error(req, 401, 'unauthorized');
  const userId = auth.user.id;
  const admin = adminClient();

  try {
    await removeFolder(admin, userId, 0);
    await removeTutorFiles(admin, userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;
    return json(req, 200, { ok: true });
  } catch (e) {
    // Log only a generic message and the user id: no tokens, no payloads.
    console.error('delete-account failed', userId, e instanceof Error ? e.message : 'unknown');
    return error(req, 500, 'delete_failed');
  }
});

/** Storage listing is not recursive: walk <user>/<card>/<file>. */
async function removeFolder(admin: ReturnType<typeof adminClient>, prefix: string, depth: number): Promise<void> {
  if (depth > 3) return;
  for (;;) {
    const { data, error: listErr } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (listErr) throw listErr;
    if (!data || data.length === 0) return;
    const files = data.filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
    const folders = data.filter((o) => !o.id).map((o) => `${prefix}/${o.name}`);
    for (const f of folders) await removeFolder(admin, f, depth + 1);
    if (files.length) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(files);
      if (rmErr) throw rmErr;
    }
    if (data.length < 1000) return;
  }
}

/** Photos and PDFs the student sent to the tutor live in Anthropic's Files API; delete them too. */
async function removeTutorFiles(admin: ReturnType<typeof adminClient>, userId: string): Promise<void> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return;
  const { data, error: qErr } = await admin.from('tutor_files').select('file_id').eq('user_id', userId);
  if (qErr) throw qErr;
  const client = new Anthropic({ apiKey: key });
  for (const { file_id } of data ?? []) {
    try {
      await client.files.delete(file_id);
    } catch (e) {
      // Already gone (404) is fine; anything else is logged without details and does not block deletion.
      if (!(e instanceof Anthropic.NotFoundError)) console.error('tutor file delete failed', userId, e instanceof Anthropic.APIError ? e.status : 'unknown');
    }
  }
}
