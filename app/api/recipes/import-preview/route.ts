import { NextResponse } from 'next/server';
import { parseRecipePage } from '@/domain/recipes/import-preview';
import { validateRecipeImportUrl } from '@/domain/recipes/import-urls';
import { loadPublicRecipePage, RecipeWebsiteError } from '@/services/recipe-web-fetch';
import { getCurrentHousehold } from '@/services/households';

export const runtime = 'nodejs';

/** Authenticated, on-demand preview. Never saves a recipe or other household data. */
export async function POST(request: Request) {
  const household = await getCurrentHousehold();
  if (!household.ok) return NextResponse.json({ error: household.error.message },
    { status: household.error.code === 'unauthorized' ? 401 : 503 });

  if (Number(request.headers.get('content-length')) > 4096) {
    return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Send a recipe webpage URL.' }, { status: 400 }); }
  const raw = body && typeof body === 'object' && 'url' in body
    ? (body as { url: unknown }).url : null;
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'Paste a recipe webpage URL.' }, { status: 400 });
  }
  const checked = validateRecipeImportUrl(raw);
  if (!checked.ok) return NextResponse.json({ error: checked.message }, { status: 400 });

  try {
    const loaded = await loadPublicRecipePage(checked.url);
    const draft = parseRecipePage(loaded.html, loaded.finalUrl);
    if (!draft) return NextResponse.json({
      error: 'This page did not expose a readable recipe. Paste its recipe text below instead.',
    }, { status: 422 });
    return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const reason = error instanceof RecipeWebsiteError ? error.kind : 'unexpected';
    // Log a short diagnostic category, never recipe page content or URL parameters.
    console.warn('[recipe-import] preview failed', { reason });
    const message = error instanceof RecipeWebsiteError
      ? error.message
      : 'Grimmy could not preview this recipe. Try pasting the recipe text below.';
    return NextResponse.json({ error: message, reason }, { status: 422 });
  }
}
