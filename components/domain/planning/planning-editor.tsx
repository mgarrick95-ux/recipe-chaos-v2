'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { lockMealAction, saveContextAction, savePlanAction, selectMealAction } from '@/app/plan/actions';
import type { PlanContextInput, PlanningView } from '@/services/planning';
import { PlanShoppingReview } from './plan-shopping-review';

export function PlanningEditor({ view }: { view: PlanningView }) {
  const router = useRouter();
  const [count, setCount] = useState(view.plan?.mealCount ?? 3);
  const [context, setContext] = useState<PlanContextInput>(view.plan?.context ?? {
    energyLevel: '', budgetMode: '', effortLevel: '', maxCookingTimeMinutes: '', notes: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) {
    setError('');
    setNotice('');
    startTransition(async () => {
      const result = await task();
      if (!result.ok) { setError(result.error?.message ?? 'Something went wrong.'); return; }
      setNotice(success);
      router.refresh();
    });
  }
  const plan = view.plan;
  return <div className="space-y-7">
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    <section className="panel space-y-4">
      <h2 className="section-title">How many meals?</h2>
      <p className="muted text-sm">You can leave slots empty and decide later. Choose 1 to 14.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        run(() => savePlanAction(view.week, count), plan ? 'Meal count saved.' : 'Plan created.');
      }}>
        <div><label className="field-label" htmlFor="meal-count">Meals this week</label>
          <input id="meal-count" type="number" min="1" max="14" step="1" required disabled={pending} value={count}
            onChange={event => setCount(Number(event.target.value))} className="w-32" /></div>
        <button className="btn btn-primary" disabled={pending} type="submit">{plan ? 'Save meal count' : 'Create plan'}</button>
      </form>
    </section>
    {plan && <>
      <section className="space-y-4" aria-labelledby="plan-meals">
        <h2 id="plan-meals" className="section-title">Your meals</h2>
        {view.recipes.length === 0 && <div className="panel muted">Add a recipe first, then choose it here. <Link className="text-link" href="/recipes/new">Add a recipe →</Link></div>}
        <div className="grid gap-4">{plan.slots.map(slot => <article key={slot.id} className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Meal {slot.position}</h3>
            <button type="button" className="btn" disabled={pending} onClick={() =>
              run(() => lockMealAction(slot.id, slot.updatedAt, !slot.locked), slot.locked ? 'Meal unlocked.' : 'Meal locked.')
            }>{slot.locked ? 'Unlock' : 'Lock'}</button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[15rem] flex-1"><label className="field-label" htmlFor={`recipe-${slot.id}`}>Recipe</label>
              <select id={`recipe-${slot.id}`} className="w-full rounded-[.65rem] border border-[#455452] bg-[#111a19] px-4 py-3"
                disabled={pending || slot.locked || view.recipes.length === 0} value={slot.recipeId ?? ''}
                onChange={event => run(() => selectMealAction(slot.id, event.target.value || null), 'Meal saved.')}>
                <option value="">Choose later</option>
                {view.recipes.map(recipe => <option value={recipe.id} key={recipe.id}>{recipe.title}</option>)}
              </select></div>
            {slot.recipeId && <Link className="btn" href={`/recipes/${slot.recipeId}`}>View recipe</Link>}
          </div>
          {slot.locked && <p className="muted text-sm">Unlock this meal to swap or remove its recipe.</p>}
        </article>)}</div>
      </section>
      {plan.slots.some((slot) => slot.recipeId) && <PlanShoppingReview planId={plan.id} />}
      <section className="panel space-y-4" aria-labelledby="planning-context">
        <div><h2 id="planning-context" className="section-title">What does this week feel like?</h2>
          <p className="muted mt-1 text-sm">Optional notes for planning. You can change these anytime.</p></div>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); run(() => saveContextAction(plan.id, context), 'Planning notes saved.'); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="plan-energy">Energy</label><input id="plan-energy" maxLength={80} value={context.energyLevel} disabled={pending} placeholder="Low, mixed, plenty…"
              onChange={event => setContext(c => ({ ...c, energyLevel: event.target.value }))} /></div>
            <div><label className="field-label" htmlFor="plan-budget">Budget</label><input id="plan-budget" maxLength={80} value={context.budgetMode} disabled={pending} placeholder="Keep it inexpensive…"
              onChange={event => setContext(c => ({ ...c, budgetMode: event.target.value }))} /></div>
            <div><label className="field-label" htmlFor="plan-effort">Cooking effort</label><input id="plan-effort" maxLength={80} value={context.effortLevel} disabled={pending} placeholder="Easy meals, some prep…"
              onChange={event => setContext(c => ({ ...c, effortLevel: event.target.value }))} /></div>
            <div><label className="field-label" htmlFor="plan-time">Maximum cooking time (minutes)</label><input id="plan-time" type="number" min="0" max="1440" step="1" value={context.maxCookingTimeMinutes} disabled={pending}
              onChange={event => setContext(c => ({ ...c, maxCookingTimeMinutes: event.target.value }))} /></div>
          </div>
          <div><label className="field-label" htmlFor="plan-notes">Other notes</label><textarea id="plan-notes" maxLength={1000} rows={3} value={context.notes} disabled={pending} placeholder="Anything else to keep in mind?"
            onChange={event => setContext(c => ({ ...c, notes: event.target.value }))} /></div>
          <button className="btn btn-primary" type="submit" disabled={pending}>Save notes</button>
        </form>
      </section>
    </>}
  </div>;
}
