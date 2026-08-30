# Recipe Chaos V2 Build Plan

Phase 0 is approved. Do not begin a phase until its scope is explicitly active, and do not pull future-phase schema, AI, UI, or automation forward for convenience.

## Phase 1: Foundation

Objective: Establish project conventions, Supabase/Postgres foundation, validation, routing shape, and safe development workflow.

Build: Folder structure, shared types location, environment handling, Supabase client setup plan, migration workflow, RLS baseline approach, household-aware ownership assumptions, validation utilities, and test/build scripts.

Do not build yet: Product features, broad future schema, AI, imports, recommendation logic, family-management UI, invitations, or roles UI.

Acceptance criteria: App runs, TypeScript passes, lint passes, production build passes, Supabase schema changes are migration-backed, RLS expectations are documented for any introduced table, and architecture docs match the implemented structure.

Manual smoke tests: Start the app, load the home route, confirm no console/runtime errors.

Git checkpoint: `checkpoint/foundation`

## Phase 2: Ingredient Intelligence

Objective: Create the shared ingredient normalization foundation.

Build: Small application-owned canonical ingredient schema, aliases, deterministic normalization, parser types, matching confidence model, "keep separate" semantics, and service tests.

Do not build yet: AI matching, fuzzy auto-merges, huge external ingredient taxonomies, recipe import AI, receipt OCR, inventory automation, or UI-heavy matching flows.

Acceptance criteria: Recipes, inventory, shopping, and intake can all reference the same ingredient identity model while original human-readable text remains preserved separately.

Manual smoke tests: Verify examples such as garlic versus garlic powder, brown sugar versus granulated sugar, and almond milk versus dairy milk remain distinct unless explicitly mapped.

Git checkpoint: `checkpoint/ingredient-intelligence`

## Phase 3: Recipes

Objective: Support durable saved recipes using original text plus structured ingredients.

Build: Recipe CRUD, ingredients, steps, tags, favorites, source URL, notes, and structured ingredient links.

Do not build yet: Full Meal Brain, automated imports, Cook Mode, or shopping generation beyond simple manual hooks.

Acceptance criteria: A user can create, edit, favorite, delete, and view a recipe without losing original ingredient text.

Manual smoke tests: Add a recipe with ambiguous ingredients, edit it, reload, and confirm structured fields do not overwrite display text unexpectedly.

Git checkpoint: `checkpoint/recipes`

## Phase 4: FrostPantry And Intake

Objective: Track current food inventory and establish review-before-commit imports.

Build: Pantry/fridge/freezer/leftovers inventory, manual quick add/edit, intake session records, parsed intake item review states, and simple inventory events for provenance/history.

Do not build yet: Automatic receipt/photo commits, grocery integrations, meal reservations, or a complex accounting ledger.

Acceptance criteria: Inventory changes are explicit, traceable through simple inventory events, recoverable, and scoped to the household.

Manual smoke tests: Add items manually, mark use-soon, move locations, process a sample pasted receipt into review, approve one item, reject one item, and keep one separate.

Git checkpoint: `checkpoint/frostpantry-intake`

## Phase 5: Shopping

Objective: Provide one simple visible shopping list with preserved source/intention.

Build: Manual shopping items, checked state, clear checked, derived item generation from approved recipe selections, duplicate advisory flow, inventory awareness, and idempotent sync.

Do not build yet: Full Meal Brain ranking, external grocery integrations, or silent quantity merging.

Acceptance criteria: Manual items persist, derived sync is repeatable, and generation reports honest no-op results.

Manual smoke tests: Add a manual item, generate missing ingredients from a selected meal, check items, clear checked, rerun generation, and verify duplicates are advisory.

Git checkpoint: `checkpoint/shopping`

## Phase 6: Weekly Planning

Objective: Build the single weekly plan source of truth.

Build: Flexible meal count, Meal 1/2/3 slots, manual recipe selection, lock/swap/remove states, planning context, and plan-to-shopping handoff.

Do not build yet: Autonomous smart recommendations, weekday obligation model, or separate smart-plan persistence.

Acceptance criteria: Manual and assisted-ready views read and write the same plan records.

Manual smoke tests: Create a plan with three meals, lock one, swap one, add one manually, generate shopping, and confirm plan state remains consistent after reload.

Git checkpoint: `checkpoint/weekly-planning`

## Phase 7: Meal Brain

Objective: Add ranked assisted suggestions without taking control from the user.

Build: Transient candidate scoring, ingredient coverage, use-soon urgency, overlap scoring, budget/energy/effort inputs, favorites, recent meals, rejection signals, suggestion reasons, locks, swaps, regenerate-unlocked behavior, and persistence only for useful decisions/feedback.

Do not build yet: Fully autonomous planning, nagging reminders, hidden inventory/shopping mutations, or persistence of every derived score/explanation.

Acceptance criteria: Suggestions remain separate from committed selections until approved.

Manual smoke tests: Generate a plan, lock one meal, regenerate the rest, reject a suggestion, manually add a recipe, approve the plan, and confirm only approved meals affect shopping.

Git checkpoint: `checkpoint/meal-brain`

## Phase 8: Cook Mode

Objective: Restore low-pressure cooking assistance.

Build: Step navigation, top/bottom previous and next controls, ingredient visibility, optional keep-screen-awake support, and lightweight progress states.

Do not build yet: Enforcement, blocking required checkoffs, or complex voice/automation.

Acceptance criteria: Cook Mode helps awareness without preventing the user from moving freely.

Manual smoke tests: Open a recipe from the weekly plan, move forward and backward through steps, mark ingredients done/missed, and reload without losing progress unexpectedly.

Git checkpoint: `checkpoint/cook-mode`

## Phase 9: Learning And Automation

Objective: Let behavior quietly improve suggestions.

Build: Feedback events, ranking adjustments, repeated approval/rejection signals, preferred effort patterns, common low-energy meals, and staple suggestions.

Do not build yet: Shame-based reminders, hard commitments, or opaque ranking changes with no user override.

Acceptance criteria: Learning influences ranking while user choices remain authoritative.

Manual smoke tests: Approve and reject sample meals over several plans, then verify ranking changes are understandable and reversible.

Git checkpoint: `checkpoint/learning`

## Phase 10: PWA And Polish

Objective: Make the app reliable and pleasant on phones and in real kitchen use.

Build: PWA basics, responsive polish, loading/error states, offline-aware read paths where practical, accessibility passes, runtime smoke coverage, and deployment hardening.

Do not build yet: Native apps or broad SaaS administration.

Acceptance criteria: Core workflows work comfortably on mobile and survive ordinary network/loading states.

Manual smoke tests: Run the full household workflow on mobile viewport: recipes, inventory, planning, shopping, and Cook Mode.

Git checkpoint: `checkpoint/pwa-polish`
