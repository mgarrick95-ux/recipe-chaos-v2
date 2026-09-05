'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteRecipeAction, favoriteRecipeAction } from '@/app/recipes/actions';
import { recipeErrorMessage } from './messages';

export function RecipeActions({ id, isFavorite, updatedAt }: { id: string; isFavorite: boolean; updatedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  function mutate(kind: 'favorite' | 'delete') {
    if (kind === 'delete' && !window.confirm("Delete this recipe? This can't be undone.")) return;
    setMessage('');
    startTransition(async () => {
      try {
        const result = kind === 'delete' ? await deleteRecipeAction(id, true) : await favoriteRecipeAction(id, !isFavorite, updatedAt);
        if (!result.ok) { setMessage(recipeErrorMessage(result.error)); return; }
        if (kind === 'delete') router.push('/recipes');
      } catch { setMessage('Something went wrong. Please try again.'); }
    });
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <Link href={`/recipes/${id}/edit`} className="btn btn-primary">Edit recipe</Link>
      <button className="btn" disabled={pending} aria-pressed={isFavorite} onClick={() => mutate('favorite')}><span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>{isFavorite ? 'Unfavorite' : 'Favorite'}</button>
      <button className="btn btn-danger" disabled={pending} onClick={() => mutate('delete')}>Delete</button>
    </div>
    {pending && <p role="status" className="muted text-sm">Saving your change…</p>}
    {message && <div role="alert" className="error-message">{message} <a href={`/recipes/${id}`} className="text-link">Reload recipe</a></div>}
  </div>;
}
