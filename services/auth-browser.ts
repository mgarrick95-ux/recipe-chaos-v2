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

export async function signUp(email: string, password: string) {
  try {
    const supabase = createBrowserSupabaseClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/recipes`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      return err('validation_error', 'We could not create that account. Check the details and try again.');
    }
    return ok({ needsEmailConfirmation: data.session === null });
  } catch {
    return err('unexpected_error', 'Account creation is unavailable right now. Please try again.');
  }
}

export async function requestPasswordReset(email: string) {
  try {
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      return err('unexpected_error', 'We could not send a reset email right now. Please try again.');
    }
    return ok(null);
  } catch {
    return err('unexpected_error', 'Password reset is unavailable right now. Please try again.');
  }
}

export async function updatePassword(password: string) {
  try {
    const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
    if (error) {
      return err('validation_error', 'We could not update your password. Please request a fresh reset link and try again.');
    }
    return ok(null);
  } catch {
    return err('unexpected_error', 'Password update is unavailable right now. Please try again.');
  }
}
