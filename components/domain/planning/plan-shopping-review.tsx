'use client';

import { useState, useTransition } from 'react';
import { approvePlanShoppingAction, reviewPlanShoppingAction } from '@/app/plan/actions';
import type { PlanShoppingReviewRow } from '@/domain/planning/shopping-review';

export function groupPlanShoppingReview(rows: PlanShoppingReviewRow[]) {
  return {
    eligible: rows.filter((row) => row.eligibleForAddition),
    alreadyShopping: rows.filter((row) => row.status === 'already_manual' || row.status === 'already_plan'),
    alreadyPantry: rows.filter((row) => row.status === 'covered_by_pantry'),
  };
}

export function defaultPlanShoppingSelection(rows: PlanShoppingReviewRow[]): Set<string> {
  return new Set(rows.filter((row) => row.eligibleForAddition && row.defaultSelected).map((row) => row.originKey));
}

export function togglePlanShoppingSelection(current: ReadonlySet<string>, originKey: string): Set<string> {
  const next = new Set(current);
  if (next.has(originKey)) next.delete(originKey);
  else next.add(originKey);
  return next;
}

export function PlanShoppingReview({ planId }: { planId: string }) {
  const [rows, setRows] = useState<PlanShoppingReviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function loadReview() {
    setError('');
    setNotice('');
    startTransition(async () => {
      const result = await reviewPlanShoppingAction(planId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRows(result.data);
      setSelected(defaultPlanShoppingSelection(result.data));
    });
  }

  function approve() {
    if (!rows || selected.size === 0) return;
    setError('');
    setNotice('');
    const origins = rows.filter((row) => selected.has(row.originKey)).map((row) => ({
      slotId: row.slotId,
      recipeIngredientId: row.recipeIngredientId,
    }));
    startTransition(async () => {
      const result = await approvePlanShoppingAction(planId, origins);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setNotice(approvalMessage(result.data.counts));
      const refreshed = await reviewPlanShoppingAction(planId);
      if (refreshed.ok) {
        setRows(refreshed.data);
        setSelected(defaultPlanShoppingSelection(refreshed.data));
      }
    });
  }

  function toggle(originKey: string) {
    setSelected((current) => togglePlanShoppingSelection(current, originKey));
  }

  if (rows === null) {
    return <section className="panel space-y-4" aria-labelledby="plan-shopping-title">
      <div>
        <h2 id="plan-shopping-title" className="section-title">Ready to check ingredients?</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">Review what your planned recipes call for against FrostPantry and Shopping. Nothing is added until you approve it.</p>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" disabled={pending} onClick={loadReview}>
        {pending ? 'Checking ingredients…' : 'Review ingredients'}
      </button>
    </section>;
  }

  return <PlanShoppingReviewContent
    rows={rows}
    selected={selected}
    pending={pending}
    error={error}
    notice={notice}
    onRefresh={loadReview}
    onApprove={approve}
    onToggle={toggle}
  />;
}

export function PlanShoppingReviewContent({ rows, selected, pending, error, notice, onRefresh, onApprove, onToggle }: {
  rows: PlanShoppingReviewRow[];
  selected: ReadonlySet<string>;
  pending: boolean;
  error: string;
  notice: string;
  onRefresh: () => void;
  onApprove: () => void;
  onToggle: (originKey: string) => void;
}) {
  const grouped = groupPlanShoppingReview(rows);

  return <section className="panel space-y-7" aria-labelledby="plan-shopping-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id="plan-shopping-title" className="section-title">Review ingredients</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">Choose what to add, then review what is already covered by Shopping or FrostPantry.</p>
      </div>
      <button type="button" className="btn" disabled={pending} onClick={onRefresh}>Refresh review</button>
    </div>

    <ReviewSection title="Add to Shopping" count={grouped.eligible.length}
      helper="Select only the ingredients you want added. Nothing changes until you approve.">
      {grouped.eligible.length > 0 ? <>
        <div className="grid gap-3">
          {grouped.eligible.map((row) => <SelectableReviewRow
            key={row.originKey}
            row={row}
            checked={selected.has(row.originKey)}
            pending={pending}
            onToggle={() => onToggle(row.originKey)}
          />)}
        </div>
        <div className="flex flex-col items-start gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
          <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={pending || selected.size === 0} onClick={onApprove}>
            {pending ? 'Updating Shopping…' : 'Add selected to Shopping'}
          </button>
          <span className="muted text-sm">{selected.size === 0 ? 'Choose any items you want to add.' : `${selected.size} selected`}</span>
        </div>
      </> : <p className="muted rounded-xl border border-white/10 bg-black/10 p-4 text-sm leading-6">
        {rows.length === 0
          ? 'Your selected recipes do not have any ingredients to review yet.'
          : 'Nothing needs adding right now. Your planned ingredients are already covered.'}
      </p>}
    </ReviewSection>

    <ReviewSection title="Already on Shopping" count={grouped.alreadyShopping.length}
      helper="These are already listed and will not be changed.">
      {grouped.alreadyShopping.length > 0
        ? <div className="grid gap-3">{grouped.alreadyShopping.map((row) => <ReadOnlyReviewRow key={row.originKey} row={row} />)}</div>
        : <p className="muted text-sm">No planned ingredients are already on Shopping.</p>}
    </ReviewSection>

    <ReviewSection title="Already in FrostPantry" count={grouped.alreadyPantry.length}
      helper="These ingredients are covered by active pantry inventory.">
      {grouped.alreadyPantry.length > 0
        ? <div className="grid gap-3">{grouped.alreadyPantry.map((row) => <ReadOnlyReviewRow key={row.originKey} row={row} />)}</div>
        : <p className="muted text-sm">No planned ingredients are currently covered by FrostPantry.</p>}
    </ReviewSection>

    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
  </section>;
}

function ReviewSection({ title, count, helper, children }: {
  title: string;
  count: number;
  helper: string;
  children: React.ReactNode;
}) {
  return <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
    <div>
      <h3 className="text-base font-semibold uppercase tracking-[0.08em]">{title} <span className="muted font-normal">({count})</span></h3>
      <p className="muted mt-1 text-sm leading-6">{helper}</p>
    </div>
    {children}
  </section>;
}

function SelectableReviewRow({ row, checked, pending, onToggle }: {
  row: PlanShoppingReviewRow;
  checked: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return <label className="block cursor-pointer rounded-xl border border-teal-300/20 bg-teal-300/5 p-4 transition-colors hover:bg-teal-300/10">
    <div className="flex items-start gap-4">
      <input className="mt-1 min-h-5 min-w-5 shrink-0" type="checkbox" checked={checked} disabled={pending} onChange={onToggle} aria-label={`Add ${row.originalText} from ${row.recipeTitle} to Shopping`} />
      <div className="min-w-0 flex-1">
        <p className="authored font-medium">{row.originalText}</p>
        <p className="muted mt-1 text-xs">From {row.recipeTitle}{row.optional ? ' · Optional' : ''}</p>
        <p className="muted mt-2 text-sm leading-6">{eligibleStatusText(row)}</p>
      </div>
    </div>
  </label>;
}

function ReadOnlyReviewRow({ row }: { row: PlanShoppingReviewRow }) {
  return <article className="rounded-xl border border-white/10 bg-black/10 p-4">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-base font-semibold text-teal-200" aria-hidden="true">✓</span>
      <div className="min-w-0 flex-1">
        <p className="authored font-medium">{row.originalText}</p>
        <p className="muted mt-1 text-xs">From {row.recipeTitle}</p>
        <p className="muted mt-2 text-sm leading-6">{readOnlyStatusText(row)}</p>
      </div>
    </div>
  </article>;
}

function eligibleStatusText(row: PlanShoppingReviewRow): string {
  if (row.status === 'missing') return 'Looks like you may need this.';
  if (row.status === 'uncertain') return "Recipe Chaos isn't sure what this matches.";
  return 'Optional ingredient.';
}

function readOnlyStatusText(row: PlanShoppingReviewRow): string {
  if (row.status === 'already_manual') return 'Already on your list. Your manual item stays unchanged.';
  if (row.status === 'already_plan') return 'Already added from this plan.';
  return 'Already in FrostPantry.';
}

function approvalMessage(counts: {
  added: number;
  already_in_pantry: number;
  already_manual: number;
  already_plan: number;
  stale_or_invalid: number;
}): string {
  const details: string[] = [];
  if (counts.added) details.push(`${counts.added} added to Shopping`);
  if (counts.already_in_pantry) details.push(`${counts.already_in_pantry} already in FrostPantry`);
  if (counts.already_manual) details.push(`${counts.already_manual} already on your manual Shopping list`);
  if (counts.already_plan) details.push(`${counts.already_plan} already added from this plan`);
  if (counts.stale_or_invalid) details.push(`${counts.stale_or_invalid} changed and were safely skipped`);
  return details.length ? `${details.join(' · ')}.` : 'Nothing changed.';
}
