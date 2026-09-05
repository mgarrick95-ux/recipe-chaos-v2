'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { err, ok } from '@/services/result';

export async function signIn(email: string, password: string) {
  try {
    const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) return err('unauthorized', 'We could not sign you in. Check your email and password and try again.');
    return ok(null);
  } catch {
    return err('unexpected_error', 'Sign-in is unavailable right now. Please try again.');
  }
}
