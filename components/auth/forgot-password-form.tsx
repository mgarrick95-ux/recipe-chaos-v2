'use client';

import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';

import { requestPasswordReset } from '@/services/auth-browser';

const subscribe = () => () => {};

export function ForgotPasswordForm() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const emailInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return <form method="post" action="/forgot-password" className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    const email = emailInput.current?.value.trim() ?? '';
    setMessage('');
    setSuccess(false);
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setSuccess(true);
      setMessage('If that email belongs to a Recipe Chaos account, a reset link is on its way.');
    });
  }}>
    <div><label htmlFor="reset-email" className="field-label">Email</label><input ref={emailInput} id="reset-email" type="email" autoComplete="email" required disabled={!hydrated || pending} /></div>
    {message && <p className={success ? 'success-message' : 'error-message'} role={success ? 'status' : 'alert'}>{message}</p>}
    <button type="submit" className="btn btn-primary w-full" disabled={!hydrated || pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
    <p className="muted text-center text-sm"><Link className="text-link" href="/sign-in">Back to sign in</Link></p>
  </form>;
}
