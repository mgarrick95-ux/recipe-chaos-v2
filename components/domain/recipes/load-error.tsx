import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { ServiceError } from '@/services/result';

export function LoadError({ error }: { error: ServiceError }) {
  if (error.code === 'unauthorized') redirect('/sign-in');
  if (error.code === 'not_found' || error.code === 'validation_error') notFound();
  return <div className="panel space-y-4"><h1 className="section-title">Recipes are unavailable right now</h1><p className="muted">Please try again in a moment.</p><Link href="/recipes" className="btn">Back to recipes</Link></div>;
}
