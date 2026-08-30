# Recipe Chaos V2 Guardrails

Phase 0 is approved. These guardrails constrain implementation until the owner explicitly approves a later architectural or phase change.

## Product Guardrails

- No guilt UX, productivity-shame language, or nagging.
- Suggestions are not commitments.
- AI never silently overwrites user choices.
- AI never silently commits destructive or persistent changes.
- Receipt, photo, URL, OCR, and AI extraction output must be reviewed before commit.
- Manual data outranks inferred, generated, parsed, or fuzzy-matched data.
- User intent always outranks automation.
- No silent merges. Duplicates are advisory.
- "Keep separate" must be respected permanently unless the user changes it.

## Engineering Guardrails

- Do not replace real pages with temporary stubs.
- Do not use destructive Git commands unless the owner explicitly authorizes them.
- Do not run broad refactors during targeted fixes.
- Inspect existing schema, code, docs, and data flow before modifying related behavior.
- Keep schema, API contracts, domain services, and UI expectations aligned.
- Do not duplicate business logic across pages.
- Keep business logic out of large page components.
- Preserve one source of truth per domain model.
- Manual and Smart planning must use the same weekly plan model.
- Protect existing user data.
- Isolate experimental work so it is reversible.

## Validation Guardrails

- Run TypeScript checks after implementation phases.
- Run lint after implementation phases.
- Run a production build after implementation phases.
- Runtime smoke tests are required; successful compilation alone is not enough.
- Validate the actual workflow touched by the change.
- Report files changed and tests performed.

## Data Guardrails

- Never connect to the old Recipe Chaos Supabase database.
- Supabase/Postgres is the backend from the beginning.
- Migrations are the source of truth for schema changes.
- Use Row Level Security appropriately from the beginning.
- Do not rely on publicly writable anonymous tables.
- Introduce schema incrementally by implementation phase.
- Core household-owned data should use `household_id` where appropriate from day one.
- Initial behavior may assume one owner and one default household; do not build invitations, roles UI, family-management UI, or SaaS-style multi-user features yet.
- Do not silently mutate inventory from AI, OCR, URL import, receipt import, or photo import.
- Do not report shopping generation success if no item was added or changed.
- Do not store competing Manual and Smart plan records for the same weekly plan.
- Do not replace original recipe ingredient text with normalized data.
- Use deterministic, conservative ingredient normalization before AI or fuzzy matching.
- Preserve product-family distinctions such as garlic versus garlic powder, brown sugar versus granulated sugar, and dairy milk versus almond milk unless explicitly reviewed.
- Keep inventory changes traceable with simple inventory events from the first inventory implementation.
- Do not use AI in Foundation or basic deterministic Ingredient Intelligence.
- Manual Recipe, Inventory, Shopping, and Weekly Plan workflows must work without AI.
- AI may later assist with recipe parsing, receipt parsing, photo inventory recognition, and Meal Brain support, but outputs that create or modify persistent data are always advisory and review-before-commit.
- Prefer transient Meal Brain scores and explanations; persist useful user decisions/feedback, not every derived ranking detail.
