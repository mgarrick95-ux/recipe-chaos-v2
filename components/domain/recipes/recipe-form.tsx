'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { saveRecipeAction } from '@/app/recipes/actions';
import { moveRow, recipeToInput } from '@/domain/recipes/manual-entry';
import type { RecipeAggregate } from '@/domain/recipes/types';
import type { ServiceError } from '@/services/result';
import { RowEditor } from './row-editor';
import { recipeErrorMessage } from './messages';

export function RecipeForm({ recipe }: { recipe?: RecipeAggregate }) {
  const router = useRouter();
  const [fields, setFields] = useState(() => recipeToInput(recipe));
  const [ingredients, setIngredients] = useState(() => recipeToInput(recipe).ingredients.map((row) => ({ ...row, key: row.id! })));
  const [steps, setSteps] = useState(() => recipeToInput(recipe).steps.map((row) => ({ ...row, key: row.id! })));
  const nextKey = useRef(0);
  const [error, setError] = useState<ServiceError | null>(null);
  const [pending, startTransition] = useTransition();
  const cancelHref = recipe ? `/recipes/${recipe.id}` : '/recipes';
  function changeField(key: 'title' | 'description' | 'sourceUrl' | 'servings' | 'yieldText' | 'notes', value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  return <form onSubmit={(event) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveRecipeAction({ ...fields,
          ingredients: ingredients.map(({ id, originalText }) => ({ ...(id ? { id } : {}), originalText })),
          steps: steps.map(({ id, instruction }) => ({ ...(id ? { id } : {}), instruction })),
        }, recipe ? { recipeId: recipe.id, expectedUpdatedAt: recipe.updatedAt } : undefined);
        if (!result.ok) { setError(result.error); return; }
        router.push(`/recipes/${result.data.recipeId}`);
      } catch { setError({ code: 'unexpected_error', message: '' }); }
    });
  }} className="space-y-6">
    <fieldset disabled={pending} className="min-w-0 space-y-6">
      <section className="panel space-y-6" aria-labelledby="basics-heading">
        <h2 id="basics-heading" className="section-title">Start with a name</h2>
        <div><label className="field-label" htmlFor="title">Recipe title <span className="muted">(required)</span></label><input id="title" name="title" required value={fields.title} onChange={(e) => changeField('title', e.target.value)} placeholder="The pasta everyone asks for" /></div>
        <div><label className="field-label" htmlFor="description">A little about it <span className="muted">(optional)</span></label><textarea id="description" value={fields.description} onChange={(e) => changeField('description', e.target.value)} rows={2} placeholder="A weeknight regular, a family favorite…" /></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={fields.isFavorite} onChange={(e) => setFields({ ...fields, isFavorite: e.target.checked })} />Keep this one in favorites</label>
      </section>
      <section className="panel space-y-4" aria-labelledby="ingredients-heading">
        <div><h2 id="ingredients-heading" className="section-title">Ingredients</h2><p className="muted mt-2 text-sm">One line per ingredient, just as you’d write it.</p></div>
        {ingredients.map((row, index) => <RowEditor key={row.key} inputId={`ingredient-${row.key}`} kind="ingredient" index={index} count={ingredients.length} value={row.originalText}
          needsReview={recipe?.ingredients.some((saved) => saved.id === row.id && saved.verificationState === 'needs_review')}
          onChange={(originalText) => setIngredients((rows) => rows.map((item) => item.key === row.key ? { ...item, originalText } : item))}
          onRemove={() => setIngredients((rows) => rows.filter((item) => item.key !== row.key))}
          onMove={(direction) => setIngredients((rows) => moveRow(rows, index, direction))} />)}
        <button type="button" className="btn" onClick={() => { const key = `new-${nextKey.current++}`; setIngredients((rows) => [...rows, { key, originalText: '' }]); }}>+ Add ingredient</button>
      </section>
      <section className="panel space-y-4" aria-labelledby="steps-heading">
        <div><h2 id="steps-heading" className="section-title">Method</h2><p className="muted mt-2 text-sm">Add the steps you need. You can come back to this later.</p></div>
        {steps.map((row, index) => <RowEditor key={row.key} inputId={`step-${row.key}`} kind="step" index={index} count={steps.length} value={row.instruction}
          onChange={(instruction) => setSteps((rows) => rows.map((item) => item.key === row.key ? { ...item, instruction } : item))}
          onRemove={() => setSteps((rows) => rows.filter((item) => item.key !== row.key))}
          onMove={(direction) => setSteps((rows) => moveRow(rows, index, direction))} />)}
        <button type="button" className="btn" onClick={() => { const key = `new-${nextKey.current++}`; setSteps((rows) => [...rows, { key, instruction: '' }]); }}>+ Add step</button>
      </section>
      <details className="panel" open={recipe && Boolean(recipe.sourceUrl || recipe.servings || recipe.yieldText || recipe.notes) ? true : undefined}>
        <summary className="section-title">A few extra details <span className="muted text-sm font-normal">· optional</span></summary>
        <div className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="servings" className="field-label">Servings</label><input id="servings" type="number" min="0.01" step="any" value={fields.servings} onChange={(e) => changeField('servings', e.target.value)} placeholder="4" /></div>
            <div><label htmlFor="yieldText" className="field-label">Yield</label><input id="yieldText" value={fields.yieldText} onChange={(e) => changeField('yieldText', e.target.value)} placeholder="One loaf, about 12 cookies…" /></div>
          </div>
          <div><label htmlFor="sourceUrl" className="field-label">Source URL</label><input id="sourceUrl" type="url" value={fields.sourceUrl} onChange={(e) => changeField('sourceUrl', e.target.value)} placeholder="https://…" /></div>
          <div><label htmlFor="notes" className="field-label">Notes for next time</label><textarea id="notes" rows={3} value={fields.notes} onChange={(e) => changeField('notes', e.target.value)} placeholder="The little things worth remembering." /></div>
        </div>
      </details>
    </fieldset>
    {error && <div role="alert" className="error-message"><p>{recipeErrorMessage(error)}</p>
      {error.code === 'conflict' && <button type="button" className="btn mt-3" onClick={() => { if (window.confirm('Reload this recipe? Unsaved changes in this form will be lost.')) window.location.reload(); }}>Reload recipe</button>}
      {error.code === 'unauthorized' && <a href="/sign-in" target="_blank" rel="noopener noreferrer" className="text-link mt-2 inline-block">Sign in in a new tab</a>}
    </div>}
    <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
      <button disabled={pending} className="btn btn-primary" type="submit">{pending ? 'Saving…' : recipe ? 'Save changes' : 'Save recipe'}</button>
      <Link href={cancelHref} className="text-link text-sm">Cancel</Link>
      <span role="status" className="muted text-sm sm:ml-auto">{pending ? 'Keeping your recipe safe…' : 'A title is enough to start.'}</span>
    </div>
  </form>;
}
