'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { selectMealAction, suggestMealIdeasAction } from '@/app/plan/actions';
import { distributeMealSuggestions, type BrainSuggestion } from '@/domain/meal-brain/rank';
import type { PlanContextInput, WeeklyPlan } from '@/services/planning';

export function MealBrain({ plan, context, disabled = false }: {
  plan: WeeklyPlan;
  context: PlanContextInput;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [ranked, setRanked] = useState<BrainSuggestion[] | null>(null);
  const [skipped, setSkipped] = useState<Record<string, string[]>>({});
  const [batch, setBatch] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const openings = plan.slots.filter(slot => !slot.locked && !slot.recipeId);
  const suggestions = useMemo(() =>
    distributeMealSuggestions(plan.slots, ranked ?? [], skipped, batch),
  [plan.slots, ranked, skipped, batch]);

  function requestSuggestions() {
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const result = await suggestMealIdeasAction(plan.start, context);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setRanked(result.data);
        setSkipped({});
        setBatch(0);
        if (result.data.length === 0) {
          setNotice('No other saved recipes to suggest. Add another recipe whenever you like.');
        }
      } catch {
        setError('Grimmy lost his place. Please try again.');
      }
    });
  }

  function chooseIdea(slotId: string, recipe: BrainSuggestion, position: number) {
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const result = await selectMealAction(slotId, recipe.recipeId);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setNotice('Added ' + recipe.title + ' to Meal ' + position + '.');
        router.refresh();
      } catch {
        setError('That meal could not be saved. Nothing was changed here.');
      }
    });
  }

  function anotherIdea(slotId: string, recipeId: string) {
    setSkipped(previous => ({
      ...previous,
      [slotId]: [...(previous[slotId] ?? []), recipeId],
    }));
  }

  return <section className="panel meal-brain-panel space-y-5" aria-labelledby="meal-brain-title">
    <header className="meal-brain-heading">
      <div>
        <p className="eyebrow">A little help from the kitchen</p>
        <h2 id="meal-brain-title" className="section-title mt-2">Let Grimmy suggest ✦</h2>
        <p className="muted mt-2 text-sm max-w-2xl">
          Ideas for empty, unlocked meals. He checks FrostPantry, your Keepers,
          what is already on Shopping, and how much effort you have in mind.
          Nothing joins your plan until you choose it.
        </p>
      </div>
    </header>

    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}

    {openings.length === 0 ? <p className="muted text-sm">
      All your meals are filled or locked. Clear or unlock a meal when you want new ideas.
    </p> : <>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={pending || disabled}
          onClick={requestSuggestions}>
          {pending ? 'Thinking…' : ranked === null ? '✦ Suggest meals' : '✦ Recheck the kitchen'}
        </button>
        {ranked && ranked.length > 1 && <button type="button" className="btn"
          disabled={pending || disabled}
          onClick={() => { setSkipped({}); setBatch(value => value + 1); }}>
          More ideas
        </button>}
      </div>
      <p className="muted text-xs">
        Uses the planning fields above, even if you haven’t saved those edits.
        Cooking times, quantities and dietary restrictions aren’t checked yet. Review each recipe before choosing it; suggestions don’t change Shopping.
      </p>

      {ranked !== null && ranked.length > 0 && <div className="meal-brain-cards">
        {openings.map(slot => {
          const idea = suggestions[slot.id];
          return <article key={slot.id} className="meal-brain-card space-y-3">
            <p className="meal-brain-slot">Meal {slot.position} · suggestion only</p>
            {idea ? <>
              <h3 className="meal-brain-recipe-title">{idea.title}</h3>
              <div className="meal-brain-badges">
                <span>{idea.pantryCount} pantry matches</span>
                <span>{idea.alreadyShoppingCount} already on Shopping</span>
                <span>{idea.missingCount} not on hand/list</span>
                {idea.needsReviewCount > 0 && <span>{idea.needsReviewCount} need review</span>}
              </div>
              <ul className="meal-brain-reasons">
                {idea.reasons.slice(0, 5).map((reason, index) => <li key={index}>{reason}</li>)}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={pending || disabled}
                  aria-label={'Choose ' + idea.title + ' for Meal ' + slot.position}
                  onClick={() => chooseIdea(slot.id, idea, slot.position)}>Use this meal</button>
                <button type="button" className="btn" disabled={pending || disabled}
                  aria-label={'Try another idea for Meal ' + slot.position}
                  onClick={() => anotherIdea(slot.id, idea.recipeId)}>Another idea</button>
                <Link href={'/recipes/' + idea.recipeId} className="text-link self-center text-sm">View recipe ↗</Link>
              </div>
            </> : <>
              <p className="muted text-sm">No more distinct suggestions for this meal right now.</p>
              <button type="button" className="btn" disabled={pending || disabled}
                onClick={() => setSkipped(previous => ({ ...previous, [slot.id]: [] }))}>
                Start over
              </button>
            </>}
          </article>;
        })}
      </div>}
    </>}
  </section>;
}
