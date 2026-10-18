# Recipe Chaos V2 — Master Build Blueprint

**Working design and delivery brief — 18 October 2026**  
**Status:** Consolidation of prior decisions for review, **not** permission to commit, push, deploy, migrate, or rewrite existing work.  
**Repository:** `mgarrick95-ux/recipe-chaos-v2` · **Working branch:** `launch-build`  
**Stack:** Next.js 16 / TypeScript / Supabase (V2 project only)  
**Important:** The GitHub branch does **not** include the latest local, uncommitted branding/auth changes. The local VS Code worktree is authoritative for those changes.

## 1. The idea in plain English

Recipe Chaos is a **low-pressure household kitchen assistant**, not just a recipe book. Its job is to take on the mental work of figuring out what to eat and what to buy. It should make good suggestions based on what the household actually has, while **never making decisions permanent without the user's approval**.

**North star:** “Basically it needs to be me so I don't have to be.”  
**Personality:** “A slightly feral kitchen companion that is surprisingly organized underneath.”  
**Everyday promise:** Figure out food without judgment, rigid schedules, needless entry, or guilt.

## 2. One connected food workflow

**Recipes → FrostPantry → Weekly Plan → Meal Brain → Approval → Shopping → (later) Cook Mode / Learning**

1. **Recipes:** Keep a personal cookbook: add, search, view, edit, favorite and remove recipes; retain original ingredient wording and useful metadata.
2. **FrostPantry:** Know what is actually in the pantry, fridge, freezer and leftovers; easy manual entry and edits, use-soon information, transparent inventory changes.
3. **Weekly Plan:** Pick a flexible *number of meals*, not mandatory Monday/Tuesday assignments. Allow manual selections, swaps, locks and removals.
4. **Meal Brain:** Suggest meals using pantry coverage, available ingredients, overlapping shopping needs, energy/effort, time, budget, favorites and recent meals. Explain suggestions simply.
5. **Approval:** The user chooses, rejects, swaps, locks or regenerates. Unapproved suggestions never become a committed plan.
6. **Shopping:** Turn **approved** meals into a review-first list of what is missing. Respect food already owned, items already on the list, and manual shopping entries. Never double-add on repeated runs.
7. **Cook Mode (later):** Simple, mobile-friendly step navigation and ingredient visibility without mandatory task completion.
8. **Learning and intake (later):** Capture receipts, photos, URLs, PDFs or pasted text as editable *drafts*; quietly learn preferences from choices, always with clear review and override.

### Key data distinctions (must never blur)

- **Pantry = facts about food on hand.**
- **Plan = meals the user actually selected.**
- **Shopping = things the user intends to buy.**
- **Suggestions = ideas, not orders.**
- **Cooking/inventory events = explicit changes to what is on hand.**

All modules share one ingredient-identity and matching system, with conservative matching that protects distinctions such as garlic vs. garlic powder and milk vs. chocolate milk.

## 3. The visual personality

Recipe Chaos belongs within **Grimm Kreations**, with **Lil Grimmy** as a lively kitchen companion.

**Desired feel:** whimsical, handmade, curious, cozy, gently gothic, a touch mischievous; legible and useful on mobile. Think crooked recipe folios and apothecary labels, **not** a corporate dashboard or horror aesthetic.

- Potential visual ingredients: ink charcoal, parchment, plum, antique bronze and restrained accents; final palette needs visual review.
- Lil Grimmy should peek, react, and offer occasional short contextual speech bubbles; avoid repeating the character on every card.
- Motion should be light, CSS-first and disabled when reduced motion is requested.
- Real-world usability stays first: readable recipes, clear controls, accessible contrast, keyboard navigation and mobile layouts.
- Branding is **not yet approved**: visually inspect the current Recipes page before carrying a design system across the app.

## 4. Locked product and engineering guardrails

1. **No guilt language** or compulsory meal schedules; missing a plan or changing one's mind is normal.
2. **Manual input and user choices outrank derived or AI output.** AI never silently edits inventory, recipes, plans or shopping.
3. **Review before commit** for imports, OCR, receipt/photo extraction and suggestions that would create persistent data.
4. **No silent merges:** duplicates are advisory; “keep separate” means keep separate until a user decides otherwise.
5. Preserve original recipe ingredient text; normalization remains separate, deterministic and conservative before AI/fuzzy matching.
6. **One source of truth per domain;** manual and assisted planning share the same saved plan.
7. Supabase V2 only; household-scoped data, safe RLS, migration-backed schema changes, protected secrets.
8. Preserve running features and local uncommitted work; no stubs, sweeping refactors, resets or destructive Git operations.
9. Verify the actual affected workflow in addition to tests, TypeScript, lint and production build.
10. **No commit, push, merge, database migration, deployment or other irreversible action without explicit owner approval.**

## 5. What exists versus what needs attention

**Known existing V2 work, based on project history:** recipe CRUD, FrostPantry, shopping, weekly planning, Meal Brain and review-first plan-to-shopping handoff have been developed. The latest remote checkpoint was `628941522217f652277a5903001e0cc7ee400d53` on `launch-build`; the last reported remote validation there was 155 tests passing. Do not rebuild features just because they appear in this blueprint; **verify their actual current status in code first**.

**Local changes reported 17 October (uncommitted):** Recipes visuals, related recipe forms/cards, Grimm Kreations styling, Lil Grimmy asset/component and reduced-motion animation. Supabase SSR proxy and post-login navigation were added during troubleshooting. Reports indicate about 160 passing tests, but the browser **still redirected to sign-in** after successful password authentication.

**Immediate blocker:** Confirm the precise boundary between successful Supabase password login, browser cookie/session persistence, Next.js proxy/server validation and the protected `/recipes` page. Tests/build alone did not resolve the user-observed redirect loop. Diagnose with sanitized runtime evidence before making further code changes.

## 6. Implementation order from here (do not rebuild finished modules)

### Stage A — Recover a working preview

**Goal:** Log in reliably, open `/recipes`, and see the current design.

- Inspect `git status`, current branch and local diff; preserve all changes.
- Examine browser/network/session behavior without printing cookies, tokens, credentials or keys.
- Make the **smallest evidence-supported auth fix**; add a regression test for the actual failure.
- Verify login **in a real authenticated browser**, including reload, `/recipes` direct navigation and sign-out. If verification is unavailable, say exactly what remains unverified.
- Do not adjust visual design while auth remains unverified.

**Acceptance:** Sign-in persists through navigation and refresh; no redirect loop; tests/build pass.

### Stage B — Approve the Recipes visual foundation

**Goal:** Show the owner the real desktop/mobile Recipes page and refine until the Grimm Kreations look is approved.

- Preserve all current recipe features.
- Review Lil Grimmy composition, animation, hero, recipe cards and empty state.
- Fix visual issues in focused passes; keep UI accessible and mobile-ready.
- Only after visual approval, reuse the same design primitives elsewhere.

**Acceptance:** Owner likes the look; recipe list/create/edit/detail flows remain functional.

### Stage C — Close the complete launch loop

**Goal:** A new user can sign up, add recipes and food, make a flexible plan, approve it and produce a shopping list of actual missing ingredients.

- Audit existing features against `docs/LAUNCH_PLAN.md` rather than implementing duplicates.
- Fix broken links/state transitions among Recipes, FrostPantry, Plan and Shopping.
- Confirm manual entries and approved decisions survive reloads.
- For Plan→Shopping, preserve the established **three-part review**:
  1. **Add to Shopping** (selectable additions),
  2. **Already on Shopping** (read-only),
  3. **Already in FrostPantry** (read-only).
- Preserve idempotency, collision rules and inventory awareness.
- Test with meaningful real user journeys, not only render snapshots.

**Acceptance:** Core household workflow completes without silent changes, duplicates or dead ends.

### Stage D — Beta launch hardening

**Goal:** Safe and pleasant first release, not every future feature.

- Verify sign-up, login, sign-out, password recovery and first household creation.
- Verify RLS with two distinct test users and anonymous access.
- Check mobile/keyboard behavior, empty/loading/error states and safe recovery.
- Confirm environment/deployment/backup steps and protect credentials.
- Run automated checks, production build and manual smoke test.

**Acceptance:** New-user beta journey works end-to-end and respects user data.

### After beta (explicitly not launch blockers)

Full Cook Mode, photo/receipt OCR, automated recipe imports, deeper learning, more interactive Grimmy, richer PWA/offline support, household invitations, grocery integrations and other advanced AI automation.

## 7. How to develop with fewer handoffs and less usage

**One shared reference:** This blueprint provides the product direction. For implementation details and constraints, existing `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/BUILD_PLAN.md`, `docs/LAUNCH_PLAN.md` and `docs/GUARDRAILS.md` remain authoritative where they contain precise established decisions. Reconcile conflicts openly; **do not silently overwrite established documentation**.

**Local execution:** Codex in VS Code can read uncommitted files and run the app. GitHub/Supabase connectors can verify remote code/backend, but GitHub is not a substitute for local unfinished changes.

**Fewer checkpoints, not zero:** For each stage, let the coding agent inspect, implement safe related changes, add tests and validate **without waiting after every edit**. Stop for owner review only for: actual blocker/evidence it cannot obtain, visual direction approval, security/schema/data risks, or commit/push/deploy.

**Lean reporting:** At the end of a work unit, report (a) what changed, (b) working/not working, (c) test/runtime results, (d) exact owner action needed, if any. Avoid repeated file dumps, long commentary or unnecessary searches.

**Do not restart the project.** Build on what exists, verify what is actually complete, fill only verified gaps, and iterate visually with the owner.

## 8. First instruction to a local coding agent

> Read this blueprint and the existing project documents. Inspect the **current local** `launch-build` worktree and preserve all modified/untracked files. Inventory the current implementation against the blueprint in a compact done/partial/missing table; do not rebuild finished features. Begin **Stage A only**: trace the persistent Supabase login redirect loop using evidence from a real sign-in attempt, instrumenting safely where needed. Make only the smallest supported fix, add a regression test, and run checks. If authenticated browser verification is impossible, provide one precise minimal diagnostic the owner can perform. Do not commit, push, deploy, migrate, bypass authentication, or modify branding. Return a concise report.
