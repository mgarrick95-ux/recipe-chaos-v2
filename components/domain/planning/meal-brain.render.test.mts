import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { WeeklyPlan, PlanContextInput } from '../../../services/planning.ts';

const require = createRequire(import.meta.url);
type Resolution = { url: string; shortCircuit?: boolean };
type Context = { parentURL?: string };
const dataModule = (src: string): Resolution =>
  ({ url: 'data:text/javascript,' + encodeURIComponent(src), shortCircuit: true });
const { registerHooks } = require('node:module') as { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
  load(url: string, context: object, next: (url: string, context: object) => unknown): unknown;
}): void };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/navigation') return dataModule('export const useRouter=()=>({refresh(){}})');
    if (specifier === 'next/link') return dataModule('export default function Link(props){return props.children}');
    if (specifier === '@/app/plan/actions') return dataModule('export async function selectMealAction(){};export async function suggestMealIdeasAction(){}');
    if (specifier.startsWith('@/')) {
      const base = new URL('../../../' + specifier.slice(2), import.meta.url);
      return next(base.href + (existsSync(fileURLToPath(base) + '.tsx') ? '.tsx' : '.ts'), context);
    }
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.tsx') && !/\.(ts|tsx|js)$/u.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      return next(base.href + (existsSync(fileURLToPath(base) + '.tsx') ? '.tsx' : '.ts'), context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return next(url, context);
  },
});
const { MealBrain } = await import('./meal-brain.tsx');
const context: PlanContextInput = {
  energyLevel: 'low', effortLevel: 'easy', budgetMode: 'tight',
  maxCookingTimeMinutes: '20', notes: '',
};
function plan(slots: WeeklyPlan['slots']): WeeklyPlan {
  return { id: 'plan', start: '2026-10-19', mealCount: slots.length, slots, context };
}
function html(slots: WeeklyPlan['slots']) {
  return renderToStaticMarkup(createElement(MealBrain, { plan: plan(slots), context }));
}
it('shows only an invitation to generate transient meal ideas before any request', () => {
  const rendered = html([{ id: 'open', position: 1, locked: false, updatedAt: 'token', recipeId: null }]);
  assert.match(rendered, /Let Grimmy suggest/);
  assert.match(rendered, /Suggest meals/);
  assert.match(rendered, /Nothing joins your plan until you choose it/);
  assert.doesNotMatch(rendered, /Use this meal/);
});
it('never offers to fill a week whose slots are already selected or locked', () => {
  const rendered = html([
    { id: 'chosen', position: 1, locked: false, updatedAt: 'token', recipeId: 'recipe-id' },
    { id: 'locked', position: 2, locked: true, updatedAt: 'token', recipeId: null },
  ]);
  assert.match(rendered, /All your meals are filled or locked/);
  assert.doesNotMatch(rendered, /Suggest meals<\/button>/);
});
it('keeps the suggestion UI in the approved planning flow without replacing Shopping review', () => {
  const editor = readFileSync(new URL('./planning-editor.tsx', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../../../app/plan/actions.ts', import.meta.url), 'utf8');
  assert.match(editor, /<MealBrain plan=\{plan\} context=\{context\}/);
  assert.match(editor, /<PlanShoppingReview planId=\{plan.id\}/);
  assert.ok(editor.indexOf('<MealBrain') < editor.indexOf('<PlanShoppingReview planId='));
  assert.match(source, /suggestMealIdeasAction/);
  assert.match(readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8'), /\.meal-brain-card/);
});
