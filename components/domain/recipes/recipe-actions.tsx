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
    <div className="recipe-actions flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Link href={`/recipes/${id}/edit`} className="btn btn-primary maker-btn">Edit recipe</Link>
        <button className="btn maker-btn" disabled={pending} aria-pressed={isFavorite} onClick={() => mutate('favorite')}><span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>{isFavorite ? 'Remove from favorites' : 'Mark as favorite'}</button>
      </div>
      <div className="w-full border-t border-white/10 pt-4 sm:w-auto sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <button className="text-sm text-rose-200 underline decoration-rose-200/30 underline-offset-4 hover:decoration-rose-200" disabled={pending} onClick={() => mutate('delete')}>Delete recipe</button>
      </div>
    </div>
    {pending && <p role="status" className="muted text-sm">Saving your change…</p>}
    {message && <div role="alert" className="error-message">{message} <a href={`/recipes/${id}`} className="text-link">Reload recipe</a></div>}
  </div>;
}
