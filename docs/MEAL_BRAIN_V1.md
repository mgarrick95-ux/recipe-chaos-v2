# Meal Brain V1 — transient recommendations

**Status:** prepared implementation for owner review on `work/grimms-enchanted-kitchen`. This is not authorization to merge, migrate, or deploy.

## Scope
- The existing Weekly Plan remains the **only saved meal plan**. There is no second smart-plan table.
- The new **Let Grimmy suggest** panel appears after the planning context in `/plan`.
- A user clicks **Suggest meals** to make an authenticated, read-only request. Ranking uses current recipes, reviewed ingredient identity, FrostPantry stock, shopping entries, Keepers, existing planned meals, and the current unsaved energy/effort/budget input.
- Suggestions go into **empty, unlocked** slots only. “Another idea” and “More ideas” are client-only changes.
- **Use this meal** calls the existing `selectMealAction` only after an explicit click. Locked, already filled and other manually selected slots are never overwritten by suggestion generation.
- Planning context is *not* saved by the suggestion action. Shopping is still updated only through the existing three-part review and approval flow.

## Deterministic scoring
- Prefers verified pantry matches, ingredients marked use soon, favoured recipes, shared checked ingredients with selected meals, and ingredients already on Shopping.
- Penalizes missing verified ingredients, identity uncertainty, and undetailed recipes. Lower-energy text preferences use only recorded ingredient/step **counts**, not imagined prep times. Tight-budget hints raise the penalty for ingredients not already on hand or on the list.
- Selected recipes are excluded from recommendation candidates. The client also avoids repeating one recipe in multiple proposed slots.
- Stable sorting makes results reproducible; “More ideas” rotates the shortlist.

## Conservative matching and limitations
- Reuses the exact same `sameIngredient` check as the plan-to-shopping review, including product families and keep-separate rules.
- **Unverified ingredients are unknown, not a declared pantry match or a purchase need.** Optional ingredients do not count as mandatory shopping burden.
- Out-of-stock, zero-quantity, and past-dated pantry entries do not count as available. Matching checks **identity/presence, not quantities or units**; it does not certify that a recipe can be made.
- V2 does not store reliable cooking times, grocery prices, or dietary restrictions in this workflow; these preferences cannot be fully enforced. The UI says so. Notes are not parsed as strict instructions.
- There is no cooked-meal history or rejection persistence yet; ranking does not pretend to use them.
- All results are advisory and transient; no OpenAI requests and no database schema changes.

## Validation
- Pure ranking and distribution tests: `domain/meal-brain/rank.test.mts`.
- Auth/read-only household service tests: `services/meal-brain.test.mts`.
- Before acceptance, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Use a real authenticated browser to check the suggestion → alternate → explicit selection → review Shopping sequence.
- Never copy V1's separate smart-planning state into V2.

## Follow-up opportunities
- Add verified prep/cook-time metadata before claiming cooking-time filtering.
- Support plan history/meal recency and explicit feedback once the underlying model exists.
- Improve quantity/unit-aware coverage behind the existing conservative ingredient matcher.
- Evaluate whether non-optional ingredient matching requires more guided review for newly added recipes.
