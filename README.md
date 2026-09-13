# Recipe Chaos V2

Recipe Chaos is a household kitchen assistant built to reduce the mental load of feeding a household. Recipes, inventory, weekly planning, shopping, and recommendations are supporting systems for one larger goal: help the user answer **“What are we eating, what do we already have, and what do we actually need?”** without turning food into another productivity system.

## Current status

V2 is a clean rebuild of the original Recipe Chaos architecture.

- Phase 1 — Foundation: complete
- Phase 2 — Ingredient Intelligence: complete
- Phase 3 — Recipes: implemented / close-out
- Launch build: active on `launch-build`
- Next launch-critical modules: FrostPantry, Shopping, Weekly Planning, Meal Brain v1, account onboarding, launch hardening

See `docs/LAUNCH_PLAN.md` for the launch scope and `docs/BUILD_PLAN.md` for the longer product roadmap.

## Product rules that matter

- User-entered information is authoritative.
- AI, OCR, imports, and fuzzy matching never silently overwrite durable data.
- Imported or inferred changes are review-before-commit.
- No guilt UX, nagging, or rigid weekday meal obligations.
- Original recipe ingredient wording is preserved separately from normalized ingredient identity.
- Recipes, inventory, shopping, and planning share one canonical ingredient system.
- Manual and assisted planning use the same weekly plan records.
- Core data is household-scoped and protected by Supabase Row Level Security.
- V2 must never connect to the old Recipe Chaos database.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase/Postgres with RLS
- Node test runner

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in the values for the **new Recipe Chaos V2 Supabase project**:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never use credentials from `recipe-chaos-live-sync` or another older Recipe Chaos project.

4. Apply the migrations in `supabase/migrations/` to the approved V2 database.

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Validation

Before a launch-build checkpoint is considered complete, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also smoke-test the actual workflow touched by the change. Compilation alone is not sufficient.

## Repository shape

```text
app/                  routes, server actions, page composition
components/           reusable UI and domain views
domain/               pure business/domain logic
services/             persistence and application services
lib/                   Supabase, environment, and infrastructure helpers
supabase/migrations/   schema source of truth
docs/                  product, architecture, data, guardrails, launch plan
```

## Key documentation

- `docs/PRODUCT_SPEC.md` — product purpose and UX principles
- `docs/ARCHITECTURE.md` — application architecture and source-of-truth rules
- `docs/DATA_MODEL.md` — domain/data model
- `docs/BUILD_PLAN.md` — full phased roadmap
- `docs/LAUNCH_PLAN.md` — current beta-launch scope
- `docs/GUARDRAILS.md` — engineering/data safety rules
- `docs/SUPABASE_SETUP.md` — safe V2 database setup
- `AGENTS.md` — implementation rules for coding agents

## Launch philosophy

The goal of the current build is not to finish every future Recipe Chaos feature before anyone can use it. The goal is to ship the complete core food loop:

**Recipes → FrostPantry → Weekly Plan → Meal Brain → Shopping**

Then refine from real household use.
