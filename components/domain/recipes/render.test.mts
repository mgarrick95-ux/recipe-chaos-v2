import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createRecipeDraft } from '../../../domain/recipes/validation.ts';
import { createRecipeIngredient } from '../../../domain/recipes/ingredients.ts';
import type { RecipeAggregate } from '../../../domain/recipes/types.ts';

// Render the actual components/pages without installing a browser test stack.
// All auth, data, and mutation boundaries are local fakes in this test process.
const id = '00000000-0000-4000-8000-000000000001';
const token = '2026-09-05T12:00:00.123456+00:00';
const recipe: RecipeAggregate = { ...createRecipeDraft('Garlic & greens'), id, householdId: id, createdBy: id, createdAt: token, updatedAt: token,
  description: 'A weeknight keeper.', sourceUrl: 'https://example.com/recipe', notes: '  Add lemon.  ', isFavorite: true,
  ingredients: [{ ...createRecipeIngredient({ originalText: '  2 cloves garlic, minced  ' }, 0), id, createdAt: token, updatedAt: token, verificationState: 'needs_review' }],
  steps: [{ id, position: 0, instruction: '  Stir gently.  ', createdAt: token, updatedAt: token }],
};
Object.assign(globalThis, { renderRecipe: recipe });
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
    if (specifier === 'next/navigation') return dataModule('export const useRouter=()=>({push(){},replace(){},refresh(){}}); export function redirect(){throw Error("redirect")}; export function notFound(){throw Error("not found")}');
    if (specifier === '@/app/recipes/actions') return dataModule('export async function saveRecipeAction(){}; export async function favoriteRecipeAction(){}; export async function deleteRecipeAction(){}');
    if (specifier === '@/services/recipes') return dataModule('export async function getRecipe(){return {ok:true,data:globalThis.renderRecipe}}; export async function listRecipes(){return {ok:true,data:[globalThis.renderRecipe]}}');
    if (specifier === '@/services/households') return dataModule('export async function getCurrentHousehold(){return {ok:true,data:{}}}');
    if (specifier === '@/services/auth-browser') return dataModule('export async function signIn(){return {ok:false,error:{message:"Sign in unavailable"}}}');
    if (specifier === 'next/link') return next(pathToFileURL(require.resolve('next/link')).href, context);
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
const { RecipeForm } = await import('./recipe-form.tsx');
const { default: DetailPage } = await import('../../../app/recipes/[id]/page.tsx');
const { default: LibraryPage } = await import('../../../app/recipes/page.tsx');
const { default: SignInPage } = await import('../../../app/sign-in/page.tsx');

it('new form renders one required title, optional sections, and real add controls', () => {
  const html = renderToStaticMarkup(createElement(RecipeForm));
  assert.match(html, /Recipe title/);
  assert.match(html, /Add ingredient/);
  assert.match(html, /Add step/);
  assert.match(html, /A title is enough to start/);
  assert.equal((html.match(/required=""/g) ?? []).length, 1);
  assert.ok(!html.includes('canonical'));
});
it('edit form renders one authored ingredient field and accessible row controls', () => {
  const html = renderToStaticMarkup(createElement(RecipeForm, { recipe }));
  assert.match(html, />  2 cloves garlic, minced  <\/textarea>/);
  assert.match(html, /Move ingredient 1 up/);
  assert.match(html, /Remove step 1/);
  assert.match(html, /Needs review/);
  assert.ok(!html.includes('Ingredient name'));
  assert.ok(!html.includes('Quantity'));
});
it('recipe detail renders authored content, source, notes, and working action labels', async () => {
  const html = renderToStaticMarkup(await DetailPage({ params: Promise.resolve({ id }) }));
  assert.match(html, /Garlic &amp; greens/);
  assert.match(html, /  2 cloves garlic, minced  /);
  assert.match(html, /  Stir gently.  /);
  assert.match(html, /  Add lemon.  /);
  assert.match(html, /href="https:\/\/example.com\/recipe"/);
  assert.match(html, /Unfavorite/);
  assert.match(html, /Delete/);
});
it('library shows metadata and links without full ingredient content', async () => {
  const html = renderToStaticMarkup(await LibraryPage());
  assert.match(html, /Garlic &amp; greens/);
  assert.match(html, /A weeknight keeper/);
  assert.match(html, new RegExp('href="/recipes/' + id + '"'));
  assert.ok(!html.includes('2 cloves'));
});
it('sign-in renders labeled credentials with password autocomplete and no extra account flows', () => {
  const html = renderToStaticMarkup(createElement(SignInPage));
  assert.match(html, /for="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.ok(!html.includes('Sign up'));
});

it('sign-in cannot serialize credentials into a native GET URL before hydration', () => {
  const html = renderToStaticMarkup(createElement(SignInPage));
  const form = html.match(/<form\b[^>]*>/)![0];
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/sign-in"/);
  for (const id of ['email', 'password']) {
    const input = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))![0];
    assert.match(input, /disabled=""/);
    assert.doesNotMatch(input, /\bname=/);
    assert.doesNotMatch(input, /\bvalue=/);
  }
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, /JavaScript is required to sign in/);
});
