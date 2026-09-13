# Recipe Chaos V2 Beta Launch Plan

The owner has approved a launch-focused build. The purpose of this document is to keep momentum toward a usable beta without abandoning the V2 architecture or dragging every future feature into the first release.

## Launch definition

Recipe Chaos is beta-launchable when a new user can create an account, enter recipes and food they own, build or receive a flexible weekly meal plan, approve the meals they want, and receive a shopping list containing what is actually missing.

The core launch loop is:

**Recipes → FrostPantry → Weekly Plan → Meal Brain → Shopping**

The product must remain useful without AI. Meal Brain may assist with ranking and explanation, but user approval remains the only path from suggestion to committed plan data.

## Launch checkpoint 0 — Close Recipes

Status: in close-out.

Required before moving the branch back to `main`:

- Recipe create, read, update, favorite, and delete behavior remains intact.
- Original ingredient text remains authoritative and preserved.
- Stale edit conflicts do not overwrite newer changes.
- Tests, typecheck, lint, and build pass.
- Recipe workflow receives a runtime smoke test against the approved V2 database.
- Project documentation reflects actual implementation authority.

## Launch checkpoint 1 — FrostPantry

Build:

- Household-scoped `inventory_items` and `inventory_events` migrations with RLS.
- Pantry, fridge, freezer, and leftovers locations.
- Manual quick add.
- Edit quantity, unit, location, dates, staple/use-soon state, notes, and out-of-stock state.
- Explicit delete/removal.
- Simple inventory history/provenance through `inventory_events`.
- Inventory may reference the shared canonical ingredient model but manual display text remains valid without a canonical match.

Launch simplification:

- Pasted-text intake may be added as the first review-before-commit intake path.
- Receipt OCR, photo recognition, PDF parsing, and URL ingestion are not launch blockers.

## Launch checkpoint 2 — Shopping

Build:

- One visible household shopping list.
- Manual add/edit/check/uncheck/remove.
- Clear checked items.
- Canonical ingredient references where known.
- Source and intention metadata.
- Inventory-aware missing-ingredient generation from approved planned recipes.
- Idempotent plan-to-shopping sync.
- Duplicates remain advisory; no silent quantity merging.
- Honest no-op results when nothing changes.

## Launch checkpoint 3 — Weekly Planning

Build:

- One weekly/flexible meal plan source of truth.
- User-selected meal count.
- Meal 1, Meal 2, Meal 3 style slots rather than weekday obligations.
- Manual recipe selection.
- Add, remove, swap, and lock.
- Planning context for energy, effort, budget pressure, cooking time, and notes.
- Approved selections drive shopping.

Do not create separate Manual and Smart plan persistence.

## Launch checkpoint 4 — Meal Brain v1

Build a useful deterministic ranking layer before considering external AI dependence.

Candidate inputs:

- Inventory coverage.
- Use-soon inventory.
- Missing ingredient burden.
- Ingredient overlap between suggested meals.
- Favorites.
- Recent meals when history exists.
- Energy/effort/cooking-time context.
- Budget pressure.
- Explicit rejection/acceptance feedback when available.

Outputs:

- Ranked recipe suggestions.
- Short human-readable reasons.
- Missing ingredient count/summary.
- Regenerate-unlocked behavior.

Suggestions remain transient until the user approves them. Only approved recipes become plan selections and affect shopping.

## Launch checkpoint 5 — Account onboarding

A public beta cannot require the owner to create users manually in Supabase.

Build:

- Sign up.
- Sign in.
- Sign out.
- Password recovery/reset.
- Default household bootstrap after first authenticated use.
- Calm first-run empty states and obvious path to adding first recipe/inventory item.

Do not build household invitations, role-management UI, billing, organizations, or SaaS administration for beta.

## Launch checkpoint 6 — Launch hardening

Required:

- RLS verification with at least two test users and anonymous access checks.
- Production migrations reviewed for the V2 project only.
- Tests, typecheck, lint, and production build passing.
- Mobile viewport review of recipes, inventory, plan, and shopping.
- Keyboard/focus/accessibility pass for launch workflows.
- Loading/error/empty states that recover safely.
- No secrets committed to the repository.
- Deployment configuration documented and repeatable.
- Basic backup/recovery expectations documented for Supabase.

## Explicitly post-launch

These are valuable, but beta does not wait for them:

- Full Cook Mode.
- Receipt/photo OCR and recognition.
- PDF and URL recipe/intake automation.
- Deep behavioral learning and automated staple suggestions.
- Household invitation and roles UI.
- Native apps.
- Full offline mode or elaborate PWA behavior.
- Grocery-store integrations.
- Autonomous persistent AI actions.

## Working rule

A checkpoint is done when its core workflow is safe and usable, not when every imaginable refinement is finished. Once a launch-critical workflow meets its acceptance criteria, move forward and collect refinement work for the post-launch pass.
