import { NextResponse } from 'next/server';
import { foundRecipeFromMeal } from '@/domain/recipes/discovery';
import { getCurrentHousehold } from '@/services/households';

export const runtime = 'nodejs';

/**
 * Fixed-host, read-only development catalogue. Free test key is only used
 * for localhost development; production requires a supporter API key.
 */
export async function GET(request: Request) {
  const household = await getCurrentHousehold();
  if (!household.ok) return NextResponse.json({ error: household.error.message },
    { status: household.error.code === 'unauthorized' ? 401 : 503 });

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const random = new URL(request.url).searchParams.get('random') === '1';
  if (!random && (query.length < 2 || query.length > 80)) {
    return NextResponse.json({ error: 'Tell Grimmy what you feel like eating (2–80 characters).' }, { status: 400 });
  }
  const key = process.env.MEALDB_API_KEY?.trim() ||
    (process.env.NODE_ENV === 'development' ? '1' : null);
  if (!key || !/^[a-zA-Z0-9]+$/u.test(key)) {
    return NextResponse.json({
      error: 'Online catalogue discovery needs a production provider key. You can still search the wider web and import a recipe link.',
    }, { status: 503 });
  }
  const endpoint = new URL('https://www.themealdb.com/api/json/v1/' + key +
    (random ? '/random.php' : '/search.php'));
  if (!random) endpoint.searchParams.set('s', query);
  try {
    const result = await fetch(endpoint, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json' },
    });
    if (!result.ok) throw new Error('provider_failure');
    const raw: unknown = await result.json();
    const meals = raw && typeof raw === 'object' && 'meals' in raw
      ? (raw as { meals: unknown }).meals : null;
    const found = (Array.isArray(meals) ? meals : [])
      .slice(0, 15).map(foundRecipeFromMeal).filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null);
    return NextResponse.json({ found, source: 'TheMealDB' },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The recipe catalogue is unavailable right now. Try a wider-web search instead.' }, { status: 502 });
  }
}
