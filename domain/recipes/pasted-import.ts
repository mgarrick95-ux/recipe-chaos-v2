import type { ManualRecipeInput } from './manual-entry.ts';

export type PastedRecipeResult =
  | { ok: true; draft: ManualRecipeInput }
  | { ok: false; message: string };

type Section = 'intro' | 'ingredients' | 'steps' | 'notes';

function heading(line: string): Section | null {
  const normalized = line.trim()
    .replace(/^#{1,5}\s*/u, '')
    .replace(/^\*{1,2}|\*{1,2}$/gu, '')
    .replace(/:$/u, '')
    .trim().toLocaleLowerCase('en-US');
  if (/^(?:ingredients|what you need)$/u.test(normalized)) return 'ingredients';
  if (/^(?:directions|instructions|method|steps|preparation|how to make it)$/u.test(normalized)) return 'steps';
  if (/^(?:notes|tips|cook's notes)$/u.test(normalized)) return 'notes';
  return null;
}

function cleanLine(line: string): string {
  return line.trim().replace(/^(?:[-*•]\s+|\d{1,2}[.)]\s+)/u, '').trim();
}

/**
 * A best-effort local conversion for pasted recipe text, not AI inference.
 * Recognizable section headings keep ingredients and instructions distinct.
 * The result must still be reviewed in the existing recipe editor before save.
 */
export function parsePastedRecipe(text: string, enteredTitle = ''): PastedRecipeResult {
  if (typeof text !== 'string' || text.length > 25_000 || !text.trim()) {
    return { ok: false, message: 'Paste some recipe text (up to 25,000 characters).' };
  }
  if (typeof enteredTitle !== 'string' || enteredTitle.length > 180) {
    return { ok: false, message: 'The recipe title must be 180 characters or fewer.' };
  }

  const parts: Record<Section, string[]> = {
    intro: [], ingredients: [], steps: [], notes: [],
  };
  let section: Section = 'intro';
  let foundIngredients = false;
  let foundSteps = false;
  for (const line of text.replace(/\r\n?/gu, '\n').split('\n')) {
    const next = heading(line);
    if (next) {
      section = next;
      if (next === 'ingredients') foundIngredients = true;
      if (next === 'steps') foundSteps = true;
      continue;
    }
    parts[section].push(line);
  }

  if (!foundIngredients || !foundSteps) {
    return {
      ok: false,
      message: 'Add Ingredients and Instructions headings to your pasted text so Grimmy knows which lines belong where.',
    };
  }

  const intro = parts.intro.map(cleanLine).filter(Boolean);
  const title = (enteredTitle.trim() || intro.shift() || '').slice(0, 180);
  if (!title) return { ok: false, message: 'Add the recipe title above the ingredients or enter it separately.' };

  const ingredientLines = parts.ingredients.map(cleanLine).filter(Boolean).slice(0, 70);
  const instructionLines = parts.steps.map(cleanLine).filter(Boolean).slice(0, 70);
  if (!ingredientLines.length || !instructionLines.length) {
    return { ok: false, message: 'Please include at least one ingredient and one cooking instruction.' };
  }
  const notes = parts.notes.map(cleanLine).filter(Boolean).join('\n').slice(0, 2500);

  return {
    ok: true,
    draft: {
      title,
      description: intro.join('\n').slice(0, 1200),
      sourceUrl: '',
      servings: '',
      yieldText: '',
      notes,
      isFavorite: false,
      ingredients: ingredientLines.map(originalText => ({ originalText })),
      steps: instructionLines.map(instruction => ({ instruction })),
    },
  };
}
