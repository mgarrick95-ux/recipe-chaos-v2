import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib';
import { it } from 'node:test';

const require = createRequire(import.meta.url);
type Resolution = { url: string; shortCircuit?: boolean };
type Context = { parentURL?: string };
const dataModule = (source: string): Resolution => ({
  url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true,
});
const { registerHooks } = require('node:module') as { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
}): void };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return dataModule('export {}');
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return next(specifier, context);
  },
});

const { loadPublicRecipePage, RecipeWebsiteError, MAX_RECIPE_HTML_BYTES, decodeRecipeHtml } =
  await import('./recipe-web-fetch.ts');

type Transport = NonNullable<Parameters<typeof loadPublicRecipePage>[1]>;
function testTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    resolveHost: async () => ['104.21.2.2'],
    requestPage: async () => ({
      status: 200, contentType: 'text/html; charset=utf-8',
      location: null, html: '<html><script type="application/ld+json">{"@type":"Recipe","name":"Soup"}</script></html>',
    }),
    ...overrides,
  };
}
const start = 'https://recipes.example.org/chicken/';

it('loads ordinary HTTPS sites without a publisher allowlist and pins the resolved IPv4', async () => {
  const visited: string[] = [];
  const result = await loadPublicRecipePage(start, testTransport({
    resolveHost: async host => {
      assert.equal(host, 'recipes.example.org');
      return ['104.21.2.2'];
    },
    requestPage: async (url, ip) => {
      assert.equal(url.hostname, 'recipes.example.org');
      assert.equal(ip, '104.21.2.2');
      visited.push(url.href);
      return { status: 200, contentType: 'text/html', location: null, html: '<h1>Recipe</h1>' };
    },
  }));
  assert.deepEqual(visited, [start]);
  assert.equal(result.finalUrl, start);
  assert.match(result.html, /Recipe/);
});

it('blocks mixed public and private DNS answers before opening any connection', async () => {
  let requestCount = 0;
  const transport = testTransport({
    resolveHost: async () => ['104.21.2.2', '169.254.169.254'],
    requestPage: async () => { requestCount++; throw Error('Must not connect'); },
  });
  await assert.rejects(() => loadPublicRecipePage(start, transport),
    (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'blocked');
  assert.equal(requestCount, 0);
});

it('refuses local hostname and IP-literal redirects before they can be requested', async () => {
  const accessed: string[] = [];
  const transport = testTransport({
    requestPage: async (url) => {
      accessed.push(url.href);
      return { status: 301, contentType: '', location: 'https://127.0.0.1/latest', html: '' };
    },
  });
  await assert.rejects(() => loadPublicRecipePage(start, transport),
    (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'redirect');
  assert.deepEqual(accessed, [start]);
});

it('rechecks DNS and pins a fresh IP on each public redirect', async () => {
  const ips: string[] = [];
  const transport = testTransport({
    resolveHost: async host => host === 'recipes.example.org' ? ['104.21.2.2'] : ['76.76.21.21'],
    requestPage: async (url, ip) => {
      ips.push(ip);
      return url.hostname === 'recipes.example.org'
        ? { status: 302, contentType: '', location: 'https://cooking.site.net/dinner', html: '' }
        : { status: 200, contentType: 'text/html', location: null, html: 'Delicious soup' };
    },
  });
  const result = await loadPublicRecipePage(start, transport);
  assert.deepEqual(ips, ['104.21.2.2', '76.76.21.21']);
  assert.equal(result.finalUrl, 'https://cooking.site.net/dinner');
});

it('does not connect to private IPv4 answers introduced by a redirect', async () => {
  let requests = 0;
  const transport = testTransport({
    resolveHost: async host => host === 'recipes.example.org' ? ['104.21.2.2'] : ['192.168.1.5'],
    requestPage: async () => {
      requests++;
      return { status: 302, contentType: '', location: 'https://other-food-blog.com/', html: '' };
    },
  });
  await assert.rejects(() => loadPublicRecipePage(start, transport),
    (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'blocked');
  assert.equal(requests, 1);
});

it('rejects redirects to HTTP, credential URLs and redirect loops', async () => {
  for (const location of [
    'http://other-food-blog.com/',
    'https://user:secret@other-food-blog.com/',
    start,
  ]) {
    const transport = testTransport({
      requestPage: async () => ({ status: 302, location, contentType: '', html: '' }),
    });
    await assert.rejects(() => loadPublicRecipePage(start, transport),
      (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'redirect');
  }
});

it('enforces redirect limits, returned media type and HTML size', async () => {
  let redirects = 0;
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    requestPage: async () => ({
      status: 302, location: 'https://new-blog-' + ++redirects + '.com/recipe',
      contentType: '', html: '',
    }),
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'redirect');
  assert.equal(redirects, 4);

  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    requestPage: async () => ({
      status: 200, contentType: 'application/json', location: null, html: '{}',
    }),
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'content');

  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    requestPage: async () => ({
      status: 200, contentType: 'text/html', location: null,
      html: 'a'.repeat(MAX_RECIPE_HTML_BYTES + 1),
    }),
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'too_large');
});

it('rejects unavailable DNS instead of attempting an unverified connection', async () => {
  let connections = 0;
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    resolveHost: async () => { throw Error('DNS failed'); },
    requestPage: async () => { connections++; throw Error('Unexpected request'); },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'dns');
  assert.equal(connections, 0);
});

it('uses explicit verified IPv4 socket lookup for the real transport', async () => {
  // This test reads the module's guardrails; no real websites are contacted.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./recipe-web-fetch.ts', import.meta.url), 'utf8');
  assert.match(source, /lookup:\s*\(_hostname,\s*_options,\s*callback\)/u);
  assert.match(source, /callback\(null,\s*verifiedIPv4,\s*4\)/u);
  assert.match(source, /servername:\s*url\.hostname/u);
  assert.match(source, /lookup\(hostname, \{ family: 4, all: true \}\)/u);
});


it('distinguishes website refusal, throttling, missing pages and other HTTP errors', async () => {
  for (const [status, kind] of [
    [401, 'denied'],
    [403, 'denied'],
    [429, 'rate_limited'],
    [404, 'not_found'],
    [500, 'http_error'],
  ] as const) {
    await assert.rejects(
      () => loadPublicRecipePage(start, testTransport({
        requestPage: async () => ({ status, contentType: 'text/html', location: null, html: '' }),
      })),
      (error: unknown) => error instanceof RecipeWebsiteError && error.kind === kind,
    );
  }
});

it('distinguishes a connection failure from a DNS resolution failure', async () => {
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    requestPage: async () => { throw new Error('TLS connection failed'); },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'connection');
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    resolveHost: async () => { throw new Error('DNS failed'); },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'dns');
});

it('does not send another request when private IP addresses appear in DNS', async () => {
  let attempted = false;
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    resolveHost: async () => ['104.21.2.2', '127.0.0.1'],
    requestPage: async () => { attempted = true; throw Error('Unexpected request'); },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'blocked');
  assert.equal(attempted, false);
});


it('decodes normal, gzip, brotli and deflate HTML streams correctly', async () => {
  const html = '<html><h1>Soup with garlic &amp; potatoes</h1></html>';
  for (const [encoding, buffer] of [
    ['identity', Buffer.from(html)],
    ['gzip', gzipSync(html)],
    ['br', brotliCompressSync(html)],
    ['deflate', deflateSync(html)],
  ] as const) {
    const decoded = await decodeRecipeHtml(Readable.from([buffer]), encoding);
    assert.equal(decoded, html, encoding);
  }
});

it('rejects compressed pages that expand beyond the safe HTML limit', async () => {
  const compressed = gzipSync('x'.repeat(MAX_RECIPE_HTML_BYTES + 500));
  await assert.rejects(() => decodeRecipeHtml(Readable.from([compressed]), 'gzip'),
    (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'too_large');
});

it('rejects oversized uncompressed pages and unsupported encodings', async () => {
  await assert.rejects(() => decodeRecipeHtml(
    Readable.from([Buffer.alloc(MAX_RECIPE_HTML_BYTES + 1, 'x')]), 'identity',
  ), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'too_large');
  await assert.rejects(() => decodeRecipeHtml(
    Readable.from([Buffer.from('body')]), 'x-custom-encoding',
  ), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'content');
});

it('can try a second validated CDN IPv4 if the first connection fails', async () => {
  const attempted: string[] = [];
  const loaded = await loadPublicRecipePage(start, testTransport({
    resolveHost: async () => ['104.21.2.2', '76.76.21.21'],
    requestPage: async (_url, verifiedIp) => {
      attempted.push(verifiedIp);
      if (verifiedIp === '104.21.2.2') throw Error('CDN edge not responding');
      return { status: 200, contentType: 'text/html', location: null, html: 'Soup!' };
    },
  }));
  assert.deepEqual(attempted, ['104.21.2.2', '76.76.21.21']);
  assert.equal(loaded.html, 'Soup!');
});

it('never retries a server refusal, private address, or size error on another CDN address', async () => {
  const ips = ['104.21.2.2', '76.76.21.21'];
  let requests = 0;
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    resolveHost: async () => ips,
    requestPage: async () => {
      requests++;
      return { status: 403, contentType: '', location: null, html: '' };
    },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'denied');
  assert.equal(requests, 1);
  requests = 0;
  await assert.rejects(() => loadPublicRecipePage(start, testTransport({
    resolveHost: async () => ips,
    requestPage: async () => {
      requests++;
      throw new RecipeWebsiteError('too_large');
    },
  })), (error: unknown) => error instanceof RecipeWebsiteError && error.kind === 'too_large');
  assert.equal(requests, 1);
});
