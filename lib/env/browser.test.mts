import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./browser.ts', import.meta.url), 'utf8');

function browserEnv(url: string | undefined, key: string | undefined) {
  // Simulate public-env inlining, then execute without a Node process global.
  // Dynamic lookups cannot be replaced and fail in this browser-like context.
  const inlined = source
    .replace('import "client-only";', '')
    .replaceAll('process.env.NEXT_PUBLIC_SUPABASE_URL', JSON.stringify(url) ?? 'undefined')
    .replaceAll('process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', JSON.stringify(key) ?? 'undefined');
  const { outputText } = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {} as { getPublicEnv: () => { supabaseUrl: string; supabasePublishableKey: string } };
  runInNewContext(outputText, { exports });
  return exports.getPublicEnv;
}

it('reads statically inlined public values without a process global', () => {
  const env = browserEnv('https://example.supabase.co', 'public-test-key')();
  assert.equal(env.supabaseUrl, 'https://example.supabase.co');
  assert.equal(env.supabasePublishableKey, 'public-test-key');
});

it('still rejects a missing or empty public URL', () => {
  for (const value of [undefined, '']) {
    assert.throws(browserEnv(value, 'public-test-key'), /Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL/);
  }
});

it('still rejects a missing or empty publishable key', () => {
  for (const value of [undefined, '']) {
    assert.throws(browserEnv('https://example.supabase.co', value), /Missing required public environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  }
});
