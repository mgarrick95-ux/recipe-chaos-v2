# Recipe Chaos V2 Architecture

## Architecture Principles

Recipe Chaos should be built as a small Next.js App Router application with explicit domain modules. Pages and route handlers are delivery mechanisms; business rules live in reusable domain and service code.

The core architectural law is one truth:

- One canonical ingredient model.
- One inventory model.
- One recipe model.
- One weekly-plan model.
- One shopping model.
- One shared matching and normalization layer.

Manual and assisted workflows must use the same persistence model. AI and parsing features create drafts, suggestions, or review records before they create durable domain records.

Supabase/Postgres is the backend from the beginning. Database migrations are the source of truth for schema changes, and schema is introduced incrementally by implementation phase rather than creating every future table immediately. Row Level Security must be designed and enabled appropriately from the beginning; the app must not rely on publicly writable anonymous tables.

## Recommended Application Shape

Use the existing no-`src` scaffold. When implementation begins, prefer this folder structure:

```text
app/
  (app)/
    recipes/
    pantry/
    shopping/
    plan/
    cook/
  api/
components/
  domain/
  layout/
  ui/
lib/
  supabase/
  validation/
  utils/
domain/
  ingredients/
  recipes/
  inventory/
  intake/
  shopping/
  planning/
  meal-brain/
  preferences/
types/
```

`domain/` contains pure domain types, normalization, ranking, diffing, and state transition helpers. `lib/` contains adapters and infrastructure. `components/` contains reusable view pieces. `app/` keeps routing, data loading, server actions, and composition thin.

## Client And Server Responsibilities

Server responsibilities:

- Authentication and household scoping.
- Database reads and writes.
- Supabase migration-backed schema changes and RLS policy enforcement.
- Server actions or route handlers for mutations.
- Validation before persistence.
- Ingredient normalization and matching calls that depend on shared data.
- Meal Brain ranking and shopping derivation.
- AI calls only for explicit assisted features after the non-AI foundation works.

Client responsibilities:

- Low-pressure interaction, review screens, optimistic local editing where safe.
- Presenting suggestions separately from committed selections.
- Capturing user approvals, rejections, locks, swaps, and "keep separate" choices.
- Avoiding hidden persistence side effects.

Client components may manage transient UI state, but persisted state transitions should go through domain services.

## API And Service-Layer Strategy

Use a thin API/service layer around domain operations:

- Validate inputs with shared schemas.
- Load authoritative records from Supabase.
- Call domain functions to compute proposed changes.
- Persist only explicit user-approved changes.
- Return both changed records and meaningful no-op results.

Services should avoid false success. For example, shopping generation must report when no items were added because everything was already owned, already listed, or required approval.

## Ingredient Normalization

Ingredient intelligence lives in `domain/ingredients/` and is used by recipes, inventory, shopping, planning, receipt parsing, photo parsing, and imports.

It should handle:

- Original display text.
- Parsed quantity and unit.
- Canonical ingredient identity.
- Aliases and user-approved mappings.
- Descriptors and modifiers.
- Product-family distinctions.
- Matching confidence and explanation.

Start with deterministic, conservative normalization and a small application-owned canonical ingredient and alias system that can grow through real usage. Do not import a huge external ingredient taxonomy at this stage.

Always preserve original human-readable ingredient text. Store parsed, structured, and canonical interpretation separately. Product-family distinctions such as garlic versus garlic powder, brown sugar versus granulated sugar, and dairy milk versus almond milk must remain distinct unless explicitly reviewed.

Fuzzy or AI matching may propose relationships later, but uncertain matches remain advisory. Matching must not silently declare ingredients equivalent, merge records, or mutate durable records.

## Meal Brain

Meal Brain logic belongs in `domain/meal-brain/`. It should rank candidate meal sets, not directly write plans.

Inputs:

- Recipes and recipe metadata.
- Inventory coverage and use-soon urgency.
- Leftovers.
- Weekly planning context.
- Shopping burden and estimated cost signals.
- Ingredient overlap opportunities.
- Preferences, feedback, favorites, rejections, and recent meals.

Outputs:

- Ranked suggestions.
- Reasons and tradeoffs.
- Missing ingredient estimates.
- Confidence and optional alternatives.

The Weekly Planning service decides how suggestions become committed selections after user approval.

Recommendation scores and explanations should usually be calculated transiently. Persist user decisions and feedback that are useful for future learning. A compact suggestion snapshot may be added later if debugging or recommendation history requires it, but the system should not persist every derived score or explanation by default.

## Review-Before-Commit Intake

All capture flows use the same pattern:

1. Create an intake session with source type and raw source data or file reference.
2. Parse into proposed items.
3. Normalize into suggested structured data with confidence.
4. Show a review state.
5. User approves, edits, rejects, merges, or keeps separate.
6. Commit approved changes through the relevant domain service.

Raw source data should be preserved when useful so parsing can be audited or rerun.

## Source-Of-Truth Rules

- Recipes are authoritative for saved recipe content.
- Recipe ingredients preserve original text and link to structured ingredient records where known.
- Inventory items are authoritative only after manual entry or approved intake.
- Weekly plan selections are authoritative only after user approval or manual add.
- Shopping items are authoritative as list records with source metadata, not as recomputed UI-only rows.
- Derived data may be cached only if it can be regenerated or invalidated safely.
- Manual records and user overrides outrank AI, OCR, URL imports, fuzzy matches, and derived suggestions.
- User intent always outranks automation.

## Keeping Page Components Small

Pages should compose views and call server-side loading/mutation functions. They should not contain ranking logic, ingredient matching, shopping derivation, or import parsing.

When a page grows large, split by responsibility:

- Query/load function.
- Domain operation.
- Presentational component.
- Focused interactive component.
- Server action or route handler.

The testable unit should usually be the domain operation, not the page.
