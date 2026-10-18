import type { ManualRecipeInput } from '../recipes/manual-entry.ts';

type RecordValue = Record<string, unknown>;
export type RecipeImportPreview = ManualRecipeInput;

function isObject(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp|frac12|frac14|frac34|deg);/gi, (raw, part: string) => {
    const key = part.toLowerCase();
    if (key.startsWith('#')) {
      const hex = key.startsWith('#x');
      const code = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff &&
        (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : raw;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
      frac12: '½', frac14: '¼', frac34: '¾', deg: '°' } as Record<string, string>)[key] ?? raw;
  });
}

function readable(value: unknown, limit = 2000): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return decodeEntities(String(value)
    .replace(/<\/(?:p|div|li|h[1-6]|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/\n +/g, '\n')
    .trim()).slice(0, limit);
}

function steps(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap(item => steps(item, depth + 1));
  if (typeof value === 'string') {
    return value.split(/\n\s*\n/u).map(item => readable(item, 4000)).filter(Boolean);
  }
  if (!isObject(value)) return [];
  if (Array.isArray(value.itemListElement)) return steps(value.itemListElement, depth + 1);
  if (Array.isArray(value.steps)) return steps(value.steps, depth + 1);
  const description = readable(value.text ?? value.description, 4000);
  return description ? [description] : [];
}

function ingredients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (isObject(item)) return readable(item.text ?? item.name ?? item.value, 1800);
    return readable(item, 1800);
  }).filter(Boolean).slice(0, 70);
}

function recipeType(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase().replace(/^https?:\/\/schema\.org\//u, '') === 'recipe';
  return Array.isArray(value) && value.some(recipeType);
}

function findRecipe(value: unknown): RecordValue | null {
  const toVisit: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let inspected = 0;
  while (toVisit.length && inspected++ < 1500) {
    const current = toVisit.shift()!;
    if (current.depth > 12) continue;
    if (Array.isArray(current.value)) {
      for (const item of current.value.slice(0, 150)) toVisit.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (!isObject(current.value)) continue;
    if (recipeType(current.value['@type'])) return current.value;
    for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'about']) {
      const child = current.value[key];
      if (child !== undefined) toVisit.push({ value: child, depth: current.depth + 1 });
    }
  }
  return null;
}

export function previewFromRecipeObject(object: RecordValue, sourceUrl: string): RecipeImportPreview | null {
  const title = readable(object.name ?? object.headline, 180);
  if (!title) return null;
  const originalIngredients = ingredients(object.recipeIngredient ?? object.ingredients);
  const instructions = steps(object.recipeInstructions).slice(0, 70);
  const rawYield = Array.isArray(object.recipeYield) ? object.recipeYield[0] : object.recipeYield;
  const yieldText = readable(isObject(rawYield) ? rawYield.value : rawYield, 180);
  const yieldMatch = yieldText.match(/^(\d+(?:\.\d+)?)\s*(?:servings?|portions?|people|persons?)?$/iu);
  return {
    title,
    description: readable(object.description, 1200),
    sourceUrl,
    servings: yieldMatch ? yieldMatch[1] : '',
    yieldText: yieldText || '',
    notes: '',
    isFavorite: false,
    ingredients: originalIngredients.map(originalText => ({ originalText })),
    steps: instructions.map(instruction => ({ instruction })),
  };
}

/**
 * The host is validated by the fetch boundary. This function only inspects
 * embedded Schema.org Recipe data in a bounded HTML document, without scripts.
 */
export function parseRecipePage(html: string, sourceUrl: string): RecipeImportPreview | null {
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
  let script: RegExpExecArray | null;
  let tried = 0;
  while ((script = scripts.exec(html)) !== null && tried++ < 80) {
    const attrs = script[1].toLowerCase();
    if (!/\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)/u.test(attrs)) continue;
    if (script[2].length > 250000) continue;
    try {
      const raw = script[2].trim().replace(/^<!--|-->$/gu, '');
      const found = findRecipe(JSON.parse(raw));
      if (!found) continue;
      const draft = previewFromRecipeObject(found, sourceUrl);
      if (draft) return draft;
    } catch { /* Keep looking; never infer fields from unrelated page content. */ }
  }
  return null;
}
