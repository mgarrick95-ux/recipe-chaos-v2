import 'server-only';

import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isPublicRecipeIPv4, validateRecipeImportUrl } from '@/domain/recipes/import-urls';

export const MAX_RECIPE_HTML_BYTES = 1_250_000;
const MAX_REDIRECTS = 3;

export type RecipeWebsiteResponse = {
  status: number;
  contentType: string;
  location: string | null;
  html: string;
};
export type RecipeWebsiteTransport = {
  resolveHost(hostname: string): Promise<string[]>;
  requestPage(url: URL, verifiedIPv4: string): Promise<RecipeWebsiteResponse>;
};
export type LoadedRecipePage = { html: string; finalUrl: string };

export class RecipeWebsiteError extends Error {
  constructor(readonly kind:
    'address' | 'blocked' | 'redirect' | 'too_large' | 'content' |
    'dns' | 'connection' | 'denied' | 'rate_limited' | 'not_found' | 'http_error' | 'unreachable') {
    const messages = {
      address: 'That link is not a valid public HTTPS recipe webpage.',
      blocked: 'That link leads to a private or unsafe network address. Try a public recipe link.',
      redirect: 'That recipe page redirects somewhere unsafe or too many times. Try its final public recipe link.',
      too_large: 'That webpage is too large for a safe recipe preview.',
      content: 'That link did not return a readable recipe webpage.',
      dns: 'Grimmy could not resolve that website’s address. Check the link or your internet connection, then try again.',
      connection: 'Grimmy could not make a secure connection to that website. If it opens in your browser, try its Print Recipe link or paste the recipe text.',
      denied: 'That website refused the automatic request (HTTP 401/403). It may block recipe importers. Try the printable recipe page or paste its recipe text.',
      rate_limited: 'That website is temporarily limiting automated requests (HTTP 429). Try later or paste the recipe text.',
      not_found: 'That recipe link returned Not Found (HTTP 404). Open the page in your browser and check its address.',
      http_error: 'That website could not provide the recipe right now. Try later or paste its recipe text.',
      unreachable: 'Grimmy could not read that website. Try its printable recipe link or paste the recipe text instead.',
    };
    super(messages[kind]);
  }
}

/**
 * Restrict both the DNS answer AND the actual socket. Resolving an IP and
 * later calling global fetch(url) would permit DNS rebinding; do not do that.
 */
export async function loadPublicRecipePage(
  rawUrl: string,
  transport: RecipeWebsiteTransport = productionTransport,
): Promise<LoadedRecipePage> {
  let next = rawUrl;
  const visited = new Set<string>();
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const validated = validateRecipeImportUrl(next);
    if (!validated.ok) throw new RecipeWebsiteError(redirects ? 'redirect' : 'address');
    const pageUrl = new URL(validated.url);
    if (visited.has(pageUrl.href)) throw new RecipeWebsiteError('redirect');
    visited.add(pageUrl.href);

    let ips: string[];
    try {
      ips = await transport.resolveHost(pageUrl.hostname);
    } catch {
      throw new RecipeWebsiteError('dns');
    }
    // Do not connect if *any* answer is private, malformed, or reserved.
    if (!ips.length || ips.length > 30 || ips.some(ip => !isPublicRecipeIPv4(ip))) {
      throw new RecipeWebsiteError('blocked');
    }
    let response: RecipeWebsiteResponse;
    try {
      response = await transport.requestPage(pageUrl, ips[0]);
    } catch (error) {
      if (error instanceof RecipeWebsiteError) throw error;
      throw new RecipeWebsiteError('connection');
    }

    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw new RecipeWebsiteError('redirect');
      try {
        next = new URL(response.location, pageUrl).href;
      } catch {
        throw new RecipeWebsiteError('redirect');
      }
      continue; // Every redirect is checked and DNS-pinned from scratch.
    }
    if (response.status === 401 || response.status === 403) throw new RecipeWebsiteError('denied');
    if (response.status === 429) throw new RecipeWebsiteError('rate_limited');
    if (response.status === 404) throw new RecipeWebsiteError('not_found');
    if (response.status !== 200) throw new RecipeWebsiteError('http_error');
    if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/iu.test(response.contentType)) {
      throw new RecipeWebsiteError('content');
    }
    if (Buffer.byteLength(response.html, 'utf8') > MAX_RECIPE_HTML_BYTES) {
      throw new RecipeWebsiteError('too_large');
    }
    return { html: response.html, finalUrl: pageUrl.href };
  }
  throw new RecipeWebsiteError('redirect');
}

const productionTransport: RecipeWebsiteTransport = {
  // Use the OS resolver (including the user's configured Windows DNS) rather
  // than an independent DNS query. Every answer is still checked and the
  // HTTPS socket is pinned to a verified public IPv4 address.
  resolveHost: async hostname => (await lookup(hostname, { family: 4, all: true }))
    .map(record => record.address),
  requestPage: (url, verifiedIPv4) => new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: 'GET',
      agent: false,
      servername: url.hostname,
      // Hostname stays in the HTTPS URL for real certificate verification.
      // The custom lookup makes the connection use exactly the checked IP.
      lookup: (_hostname, _options, callback) => {
        callback(null, verifiedIPv4, 4);
      },
      signal: AbortSignal.timeout(9000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'RecipeChaosPreview/0.2 (user-requested recipe import)',
      },
    }, response => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === 'string' ? response.headers.location : null;
      const contentType = typeof response.headers['content-type'] === 'string'
        ? response.headers['content-type'] : '';
      const contentEncoding = response.headers['content-encoding'];
      const contentLength = Number(response.headers['content-length']);

      if (status !== 200) {
        response.destroy(); // Never read redirect/blocked-page bodies.
        resolve({ status, location, contentType, html: '' });
        return;
      }
      if ((contentEncoding && contentEncoding !== 'identity') ||
        (Number.isFinite(contentLength) && contentLength > MAX_RECIPE_HTML_BYTES)) {
        response.destroy();
        reject(new RecipeWebsiteError(
          contentEncoding && contentEncoding !== 'identity' ? 'content' : 'too_large',
        ));
        return;
      }

      void (async () => {
        const chunks: Buffer[] = [];
        let length = 0;
        for await (const chunk of response) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          length += buffer.byteLength;
          if (length > MAX_RECIPE_HTML_BYTES) {
            response.destroy();
            throw new RecipeWebsiteError('too_large');
          }
          chunks.push(buffer);
        }
        resolve({ status, location: null, contentType, html: Buffer.concat(chunks).toString('utf8') });
      })().catch(reject);
    });
    request.on('error', reject);
    request.end();
  }),
};
