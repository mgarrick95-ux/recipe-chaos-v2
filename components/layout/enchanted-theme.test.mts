import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
}

it('FrostPantry, Shopping and Weekly Plan share the enchanted shell', () => {
  for (const [path, marker] of [
    ['app/pantry/page.tsx', 'enchanted-pantry'],
    ['app/shopping/page.tsx', 'enchanted-shopping'],
    ['app/plan/page.tsx', 'enchanted-plan'],
  ]) {
    const page = source(path);
    assert.match(page, /className="enchanted-page /);
    assert.ok(page.includes(marker), path);
    assert.match(page, /className="enchanted-hero"/);
  }
});

it('FrostPantry new and edit forms inherit the same accessible theme', () => {
  for (const path of ['app/pantry/new/page.tsx', 'app/pantry/[id]/edit/page.tsx']) {
    assert.match(source(path), /enchanted-page enchanted-pantry/);
  }
  assert.match(source('components/domain/inventory/inventory-form.tsx'), /inventory-duplicate/);
});

it('preserves FrostPantry pressed-filter state and stock actions', () => {
  const browser = source('components/domain/inventory/inventory-browser.tsx');
  assert.match(browser, /const active = filter === option\.value/);
  assert.match(browser, /aria-pressed=\{active\}/);
  assert.match(browser, /setInventoryStockAction/);
  assert.match(browser, /onClick=\{\(\) => setFilter\(option\.value\)\}/);
});

it('preserves shopping edits and planning approvals with scoped visual classes', () => {
  const shopping = source('components/domain/shopping/shopping-list.tsx');
  assert.match(shopping, /enchanted-list-row/);
  assert.match(shopping, /addShoppingAction/);
  assert.match(shopping, /clearCheckedShoppingAction/);
  const editor = source('components/domain/planning/planning-editor.tsx');
  assert.match(editor, /enchanted-meal-slot/);
  assert.match(editor, /lockMealAction/);
  assert.match(editor, /selectMealAction/);
  assert.match(editor, /PlanShoppingReview/);
});

it('encapsulates the companion palette and keeps reduced-motion support', () => {
  const css = source('app/globals.css');
  assert.match(css, /\.enchanted-page \{/);
  assert.match(css, /\.enchanted-page \.panel \.muted/);
  assert.match(css, /\.enchanted-filter\[aria-pressed="true"\]/);
  assert.match(css, /\.enchanted-page :focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.recipe-world \{/);
});
