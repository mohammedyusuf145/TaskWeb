import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { connectDatabase, disconnectDatabase } from './db';
import { startSync, stopSync } from './db/sync';

export type AuthMode = 'cloud' | 'demo';

interface AuthState {
  status: 'loading' | 'signedOut' | 'ready';
  mode: AuthMode | null;
  userId: string | null;
  email: string | null;
}

export const useAuth = create<AuthState>(() => ({
  status: 'loading',
  mode: null,
  userId: null,
  email: null,
}));

const DEMO_ID_KEY = 'mizan.demoId';
const DEMO_ACTIVE_KEY = 'mizan.demoActive';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function enterCloud(session: Session) {
  const userId = session.user.id;
  if (useAuth.getState().userId === userId && useAuth.getState().mode === 'cloud') return;
  const db = connectDatabase(userId);
  useAuth.setState({ status: 'ready', mode: 'cloud', userId, email: session.user.email ?? null });
  if (supabase) startSync(db, supabase, userId);
}

function enterDemo(userId: string) {
  connectDatabase(userId);
  useAuth.setState({ status: 'ready', mode: 'demo', userId, email: null });
}

function leave() {
  stopSync();
  disconnectDatabase();
  useAuth.setState({ status: 'signedOut', mode: null, userId: null, email: null });
}

let initialized = false;

export async function initAuth() {
  if (initialized) return;
  initialized = true;

  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) enterCloud(session);
      else if (useAuth.getState().mode === 'cloud') leave();
    });
    const { data } = await supabase.auth.getSession();
    if (data.session) return enterCloud(data.session);
  }

  const s = storage();
  const demoId = s?.getItem(DEMO_ID_KEY);
  if (demoId && s?.getItem(DEMO_ACTIVE_KEY) === '1') return enterDemo(demoId);
  useAuth.setState({ status: 'signedOut' });
}

/** Local-only mode. The id is kept so returning to demo restores the same data. */
export function startDemo() {
  const s = storage();
  let id = s?.getItem(DEMO_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    s?.setItem(DEMO_ID_KEY, id);
  }
  s?.setItem(DEMO_ACTIVE_KEY, '1');
  enterDemo(id);
}

export async function signOut() {
  const { mode } = useAuth.getState();
  if (mode === 'cloud' && supabase) await supabase.auth.signOut();
  if (mode === 'demo') storage()?.removeItem(DEMO_ACTIVE_KEY);
  leave();
}

export type AuthError = 'invalid' | 'weak' | 'email' | 'generic';

function mapError(message: string | undefined): AuthError {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid';
  if (m.includes('password')) return 'weak';
  if (m.includes('email')) return 'email';
  return 'generic';
}

export async function signInWithEmail(email: string, password: string): Promise<AuthError | null> {
  if (!supabase) return 'generic';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? mapError(error.message) : null;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ error: AuthError | null; needsConfirmation: boolean }> {
  if (!supabase) return { error: 'generic', needsConfirmation: false };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { error: mapError(error.message), needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

export async function signInWithGoogle(): Promise<AuthError | null> {
  if (!supabase) return 'generic';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return error ? 'generic' : null;
}

/** Calls the delete-account Edge Function, then signs out and wipes local data. */
export async function deleteAccount(): Promise<boolean> {
  const { mode, userId } = useAuth.getState();
  if (mode === 'cloud' && supabase) {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) return false;
  }
  const name = userId ? `mizan-${userId}` : null;
  await signOut();
  if (name) indexedDB.deleteDatabase(name);
  if (mode === 'demo') storage()?.removeItem(DEMO_ID_KEY);
  return true;
}
