import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { PlanShoppingReviewRow } from '../../../domain/planning/shopping-review.ts';

const require = createRequire(import.meta.url);
type Resolution = { url: string; shortCircuit?: boolean };
type Context = { parentURL?: string };
const { registerHooks } = require('node:module') as { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
  load(url: string, context: object, next: (url: string, context: object) => unknown): unknown;
}): void };
const dataModule = (source: string): Resolution => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/app/plan/actions') return dataModule('export async function approvePlanShoppingAction(){}; export async function reviewPlanShoppingAction(){}');
    if (specifier.startsWith('@/')) {
      const base = new URL('../../../' + specifier.slice(2), import.meta.url);
      return next(base.href + (existsSync(fileURLToPath(base) + '.tsx') ? '.tsx' : '.ts'), context);
    }
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.tsx') && !/\.(ts|tsx|js)$/.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      return next(base.href + (existsSync(fileURLToPath(base) + '.tsx') ? '.tsx' : '.ts'), context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});

const { PlanShoppingReviewContent, defaultPlanShoppingSelection, groupPlanShoppingReview, togglePlanShoppingSelection } = await import('./plan-shopping-review.tsx');

function row(status: PlanShoppingReviewRow['status'], name: string): PlanShoppingReviewRow {
  const eligible = status === 'missing' || status === 'uncertain' || status === 'optional';
  return {
    planId: 'plan', slotId: `slot-${name}`, selectionId: 'selection', recipeId: 'recipe', recipeTitle: `Recipe for ${name}`,
    recipeIngredientId: `ingredient-${name}`, originalText: name, ingredientText: name, canonicalIngredientId: null,
    verificationState: status === 'uncertain' ? 'unreviewed' : 'verified', optional: status === 'optional',
    originKey: `slot-${name}:ingredient-${name}`, status, explanation: 'Domain explanation', matchingShoppingItemId: null,
    matchingShoppingSource: null, eligibleForAddition: eligible, defaultSelected: status === 'missing',
  };
}

const rows = [
  row('missing', 'missing garlic'),
  row('uncertain', 'uncertain ginger'),
  row('optional', 'optional parsley'),
  row('already_manual', 'manual onions'),
  row('already_plan', 'planned carrots'),
  row('covered_by_pantry', 'pantry rice'),
];

function render(selected = defaultPlanShoppingSelection(rows)): string {
  return renderToStaticMarkup(createElement(PlanShoppingReviewContent, {
    rows, selected, pending: false, error: '', notice: '', onRefresh() {}, onApprove() {}, onToggle() {},
  }));
}

it('groups eligible, Shopping, and FrostPantry rows into exactly one destination each', () => {
  const grouped = groupPlanShoppingReview(rows);
  assert.deepEqual(grouped.eligible.map((item) => item.originalText), ['missing garlic', 'uncertain ginger', 'optional parsley']);
  assert.deepEqual(grouped.alreadyShopping.map((item) => item.originalText), ['manual onions', 'planned carrots']);
  assert.deepEqual(grouped.alreadyPantry.map((item) => item.originalText), ['pantry rice']);
});

it('renders checkboxes only for the three Add to Shopping rows', () => {
  const html = render();
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
  assert.match(html, /Add missing garlic from Recipe for missing garlic to Shopping/);
  assert.match(html, /Add uncertain ginger from Recipe for uncertain ginger to Shopping/);
  assert.match(html, /Add optional parsley from Recipe for optional parsley to Shopping/);
  assert.doesNotMatch(html, /Add manual onions .* to Shopping/);
  assert.doesNotMatch(html, /Add planned carrots .* to Shopping/);
  assert.doesNotMatch(html, /Add pantry rice .* to Shopping/);
});

it('renders the three clear sections and read-only status text', () => {
  const html = render();
  assert.match(html, /Add to Shopping/);
  assert.match(html, /Already on Shopping/);
  assert.match(html, /Already in FrostPantry/);
  assert.match(html, /Your manual item stays unchanged/);
  assert.match(html, /Already added from this plan/);
  assert.match(html, /Already in FrostPantry\./);
});

it('selects missing by default while leaving uncertain and optional unselected', () => {
  const selected = defaultPlanShoppingSelection(rows);
  assert.equal(selected.has(rows[0].originKey), true);
  assert.equal(selected.has(rows[1].originKey), false);
  assert.equal(selected.has(rows[2].originKey), false);
  assert.equal((render(selected).match(/checked=""/g) ?? []).length, 1);
});

it('toggles Add to Shopping selection without mutating the current selection', () => {
  const current = defaultPlanShoppingSelection(rows);
  const selected = togglePlanShoppingSelection(current, rows[1].originKey);
  assert.equal(current.has(rows[1].originKey), false);
  assert.equal(selected.has(rows[1].originKey), true);
  const deselected = togglePlanShoppingSelection(selected, rows[0].originKey);
  assert.equal(deselected.has(rows[0].originKey), false);
  assert.equal((render(deselected).match(/checked=""/g) ?? []).length, 1);
});
