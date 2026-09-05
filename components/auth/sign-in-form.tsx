'use client';

import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/services/auth-browser';

const subscribe = () => () => {};

export function SignInForm() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return <form method="post" action="/sign-in" className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    const form = event.currentTarget;
    const email = emailInput.current?.value ?? '';
    const password = passwordInput.current?.value ?? '';
    setMessage('');
    startTransition(async () => {
      const result = await signIn(email, password);
      if (!result.ok) { setMessage(result.error.message); return; }
      form.reset();
      router.replace('/recipes');
      router.refresh();
    });
  }}>
    {/* No names: native form serialization must never include credentials. */}
    <div><label htmlFor="email" className="field-label">Email</label><input ref={emailInput} id="email" type="email" autoComplete="email" required disabled={!hydrated || pending} /></div>
    <div><label htmlFor="password" className="field-label">Password</label><input ref={passwordInput} id="password" type="password" autoComplete="current-password" required disabled={!hydrated || pending} /></div>
    {message && <p className="error-message" role="alert">{message}</p>}
    <button type="submit" className="btn btn-primary w-full" disabled={!hydrated || pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    {!hydrated && <p className="muted text-sm" role="status">Waiting for sign-in to load. If this stays here, reload the page.</p>}
    <noscript><p className="muted text-sm">JavaScript is required to sign in. Enable it and reload this page.</p></noscript>
  </form>;
}
