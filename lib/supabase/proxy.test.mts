import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const rootProxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
const sessionProxy = readFileSync(new URL("./proxy.ts", import.meta.url), "utf8");

it("runs the Next.js 16 proxy on application requests but not static assets", () => {
  assert.match(rootProxy, /export async function proxy/);
  assert.match(rootProxy, /refreshAuthSession\(request\)/);
  assert.match(rootProxy, /_next\/static\|_next\/image/);
  assert.match(rootProxy, /svg\|png\|jpg\|jpeg\|gif\|webp/);
});

it("refreshes verified Supabase auth and synchronizes request and response cookies", () => {
  assert.match(sessionProxy, /request\.cookies\.getAll\(\)/);
  assert.match(sessionProxy, /request\.cookies\.set\(name, value\)/);
  assert.match(sessionProxy, /response\.cookies\.set\(name, value, options\)/);
  assert.match(sessionProxy, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(sessionProxy, /auth\.getSession\(\)/);
  assert.doesNotMatch(sessionProxy, /NextResponse\.redirect/);
});
