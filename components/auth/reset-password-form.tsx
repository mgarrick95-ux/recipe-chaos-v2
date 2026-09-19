'use client';

import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { updatePassword } from '@/services/auth-browser';

const subscribe = () => () => {};

export function ResetPasswordForm() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  return <form method="post" action="/reset-password" className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    const password = passwordInput.current?.value ?? '';
    const confirmPassword = confirmInput.current?.value ?? '';
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Those passwords do not match.');
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(password);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      router.replace('/recipes');
      router.refresh();
    });
  }}>
    <div><label htmlFor="new-password" className="field-label">New password</label><input ref={passwordInput} id="new-password" type="password" autoComplete="new-password" minLength={8} required disabled={!hydrated || pending} /><p className="muted mt-2 text-xs">Use at least 8 characters.</p></div>
    <div><label htmlFor="confirm-new-password" className="field-label">Confirm new password</label><input ref={confirmInput} id="confirm-new-password" type="password" autoComplete="new-password" minLength={8} required disabled={!hydrated || pending} /></div>
    {message && <p className="error-message" role="alert">{message}</p>}
    <button type="submit" className="btn btn-primary w-full" disabled={!hydrated || pending}>{pending ? 'Saving…' : 'Save new password'}</button>
    <p className="muted text-center text-sm"><Link className="text-link" href="/sign-in">Back to sign in</Link></p>
  </form>;
}
