import { NextResponse } from 'next/server';
import { parseRecipePage } from '@/domain/recipes/import-preview';
import { validateRecipeImportUrl } from '@/domain/recipes/import-urls';
import { getCurrentHousehold } from '@/services/households';

export const runtime = 'nodejs';
const MAX_HTML_BYTES = 1_250_000;

async function boundedHtml(response: Response): Promise<string> {
  const bytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(bytes) && bytes > MAX_HTML_BYTES) throw new Error('too_large');
  if (!response.body) throw new Error('empty_body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) throw new Error('too_large');
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Explicit, authenticated, read-only preview. Never follows untrusted redirects. */
export async function POST(request: Request) {
  const household = await getCurrentHousehold();
  if (!household.ok) return NextResponse.json({ error: household.error.message },
    { status: household.error.code === 'unauthorized' ? 401 : 503 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Send a recipe page URL.' }, { status: 400 }); }
  const raw = body && typeof body === 'object' && 'url' in body ? (body as { url: unknown }).url : null;
  if (typeof raw !== 'string') return NextResponse.json({ error: 'Paste a recipe page URL.' }, { status: 400 });
  const checked = validateRecipeImportUrl(raw);
  if (!checked.ok) return NextResponse.json({ error: checked.message }, { status: 400 });
  try {
    const response = await fetch(checked.url, {
      method: 'GET', redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(9000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'RecipeChaosPreview/0.1 (on-demand recipe import)',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: 'That publisher redirected the page. Open it in your browser and copy its final recipe link.' }, { status: 422 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: 'That website did not allow Recipe Chaos to read its recipe. You can still add it manually.' }, { status: 422 });
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({ error: 'That link did not return a recipe webpage.' }, { status: 422 });
    }
    const html = await boundedHtml(response);
    const draft = parseRecipePage(html, checked.url);
    if (!draft) return NextResponse.json({
      error: 'No structured recipe was found on that page. Some publishers block previews or hide their ingredients; try another link.',
    }, { status: 422 });
    return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error && error.message === 'too_large'
        ? 'That webpage is too large to preview safely.'
        : 'Grimmy could not reach that recipe right now. Try another link or add it manually.',
    }, { status: 422 });
  }
}
