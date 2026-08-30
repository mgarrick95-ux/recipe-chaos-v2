# Recipe Chaos V2 Product Spec

Phase 0 is approved. These documents are the implementation boundary until the owner approves a later phase change.

## Purpose

Recipe Chaos is a household kitchen assistant. Its job is to carry as much of the mental load of feeding a household as possible while keeping the user in control.

It is not primarily a recipe database, pantry tracker, shopping list, or meal planner. Those are supporting systems. The product exists so the user can eventually press the equivalent of "Figure out our food" and receive calm, useful help.

## North Star

"Basically it needs to be me so I don't have to be."

Recipe Chaos should understand what food exists, what recipes are available, what the week feels like, and what constraints matter. It should propose meals, explain the useful tradeoffs, and prepare a shopping list only after the user approves the plan.

## Primary Workflow

1. The system knows pantry, fridge, freezer, leftovers, recipes, preferences, and recent meal history.
2. The user gives weekly context: energy, mood, budget pressure, available cooking effort, and number of meals needed.
3. Recipe Chaos proposes a flexible set of meals, not a rigid weekday schedule.
4. The user approves, rejects, swaps, locks, manually adds, or regenerates suggestions.
5. Approved meals become the weekly plan source of truth.
6. Required ingredients are calculated from approved meals.
7. Required ingredients are compared with current inventory.
8. The shopping list is updated with only what is actually needed.
9. Cook Mode helps the user cook without turning progress tracking into enforcement.
10. Over time, approvals, rejections, substitutions, and repeated behaviors improve future ranking.

## Modules

- Ingredient Intelligence: canonical ingredients, aliases, parsing, units, confidence, and advisory matching.
- Recipes: saved recipes, original ingredient text, structured ingredients, steps, tags, roles, cuisines, favorites, notes, and imports.
- FrostPantry: living inventory for pantry, fridge, freezer, and leftovers.
- Intake: receipt, photo, URL, PDF, and pasted text capture with review-before-commit.
- Shopping: one visible shopping list with internal source and intention tracking.
- Weekly Planning: one flexible weekly plan source of truth with manual and assisted views.
- Meal Brain: ranking and recommendation logic using inventory, preferences, budget, energy, effort, variety, overlap, and recency.
- Cook Mode: step-by-step cooking support with lightweight awareness.
- Learning: quiet personalization from behavior without shame or nagging.

## Non-Negotiable UX And Behavior

- No guilt UX or productivity-shame language.
- Skipping a suggested meal is normal.
- Forgetting is normal.
- Suggestions are not commitments.
- AI never silently overwrites user choices.
- AI never silently modifies inventory, recipes, shopping items, or plans.
- User-entered information beats inferred information.
- Receipt, photo, URL, OCR, and AI extraction output must be reviewed before becoming permanent.
- No silent merges. Ingredient, inventory, recipe, and shopping duplicates are advisory until approved.
- "Keep separate" must stay separate.
- Manual data must never be silently replaced by generated or derived data.
- Manual Recipe, Inventory, Shopping, and Weekly Plan functionality must work without AI.
- AI is not used in Foundation or basic deterministic Ingredient Intelligence.
- Later AI use cases, such as recipe parsing, receipt parsing, photo inventory recognition, and Meal Brain assistance, must be explicit and review-first when persistent user data would be created or changed.
- Destructive actions must be explicit.
- Empty states should be neutral and safe.
- Common actions should be inline where practical.
- Complex logic belongs underneath a calm, simple interface.

## Definition Of Success

Recipe Chaos succeeds when it reduces household food decisions without creating a new maintenance burden. The user should be able to recover from missed plans, messy inventory, low energy, and incomplete data without being scolded or trapped.

Early V2 success means the architecture preserves one source of truth for each domain, supports review-first ingestion, and keeps manual choices authoritative. Mature success means the Meal Brain can propose useful weekly meal sets that reduce waste, budget strain, and decision fatigue.

## What Recipe Chaos Is Not

- Not a rigid calendar-based meal planner.
- Not a diet, productivity, or habit compliance app.
- Not an autonomous agent that mutates household data without approval.
- Not a system where AI guesses become permanent facts.
- Not multiple disconnected apps hidden behind shared navigation.
- Not a SaaS-first product at the expense of the personal household workflow.
