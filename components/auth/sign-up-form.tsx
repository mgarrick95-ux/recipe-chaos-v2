'use client';

import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { signUp } from '@/services/auth-browser';

const subscribe = () => () => {};

export function SignUpForm() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return <form method="post" action="/sign-up" className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    const email = emailInput.current?.value.trim() ?? '';
    const password = passwordInput.current?.value ?? '';
    const confirmPassword = confirmInput.current?.value ?? '';
    setMessage('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setMessage('Those passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await signUp(email, password);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      if (result.data.needsEmailConfirmation) {
        setSuccess(true);
        setMessage('Check your email to confirm your account, then come back and sign in.');
        return;
      }
      router.replace('/recipes');
      router.refresh();
    });
  }}>
    <div><label htmlFor="signup-email" className="field-label">Email</label><input ref={emailInput} id="signup-email" type="email" autoComplete="email" required disabled={!hydrated || pending} /></div>
    <div><label htmlFor="signup-password" className="field-label">Password</label><input ref={passwordInput} id="signup-password" type="password" autoComplete="new-password" minLength={8} required disabled={!hydrated || pending} /><p className="muted mt-2 text-xs">Use at least 8 characters.</p></div>
    <div><label htmlFor="signup-confirm" className="field-label">Confirm password</label><input ref={confirmInput} id="signup-confirm" type="password" autoComplete="new-password" minLength={8} required disabled={!hydrated || pending} /></div>
    {message && <p className={success ? 'success-message' : 'error-message'} role={success ? 'status' : 'alert'}>{message}</p>}
    <button type="submit" className="btn btn-primary w-full" disabled={!hydrated || pending}>{pending ? 'Creating account…' : 'Create account'}</button>
    <p className="muted text-center text-sm">Already have an account? <Link className="text-teal-300 hover:underline" href="/sign-in">Sign in</Link></p>
    {!hydrated && <p className="muted text-sm" role="status">Waiting for account creation to load. If this stays here, reload the page.</p>}
  </form>;
}
