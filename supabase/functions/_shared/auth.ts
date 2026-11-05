import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.117.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Verifies the caller's JWT with Supabase Auth. Returns null if missing or invalid. */
export async function getUser(req: Request): Promise<{ user: User; client: SupabaseClient } | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user, client };
}

/** Service-role client: bypasses RLS. Only use after verifying the user, and scope every query to user.id. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
