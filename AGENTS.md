<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Recipe Chaos V2 Agent Rules

Before implementation, review `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/BUILD_PLAN.md`, and `docs/GUARDRAILS.md`.

Phase 0 is approved. Do not begin Phase 1 or any later implementation phase until the owner explicitly asks for it.

Recipe Chaos V2 is a clean rebuild. Do not copy code from older Recipe Chaos repositories, connect to old Supabase projects, install packages, create migrations, add APIs, or build UI unless the current phase explicitly allows it.

Supabase/Postgres is the backend from the beginning. Use migrations as the schema source of truth, apply Row Level Security appropriately from the start, never rely on publicly writable anonymous tables, and introduce schema incrementally by phase.

Make core data household-aware from day one while keeping behavior personal-first: one owner and one default household are acceptable initially, but no invitations, roles UI, family-management UI, or SaaS-style multi-user features until explicitly approved.

Work in small, scoped changes that preserve the documented architecture. Avoid surprise refactors, temporary stubs replacing finished features, and business logic duplicated across pages. Keep one source of truth for ingredients, inventory, recipes, weekly plans, shopping, and matching/normalization. Manual and Smart planning must use the same weekly plan model.

Manual user data is authoritative, and user intent always outranks automation. Use deterministic, conservative ingredient normalization first; preserve original ingredient text and store canonical interpretation separately. AI, OCR, fuzzy matching, receipts, photos, URLs, and imports must remain review-before-commit. Never perform destructive data actions or persistent AI-driven changes without explicit authorization.

Do not use AI in Foundation or basic deterministic Ingredient Intelligence. Manual Recipe, Inventory, Shopping, and Weekly Plan functionality must work without AI.

Inventory events are approved for the first inventory implementation as a simple provenance/history trail for manual changes and future receipt/photo/meal-driven changes; do not turn them into a complex accounting ledger.

Meal Brain scores and explanations should be calculated transiently by default. Persist genuinely useful user decisions and feedback; add compact suggestion snapshots later only if debugging or recommendation history requires them.

After implementation work, run relevant validation: TypeScript, lint, production build, and runtime smoke tests for the touched workflow. Report files changed and tests performed.

Stop and ask for owner approval when a change requires a new architectural decision, schema commitment, destructive action, external service connection, or departure from the Phase 0 documents.
