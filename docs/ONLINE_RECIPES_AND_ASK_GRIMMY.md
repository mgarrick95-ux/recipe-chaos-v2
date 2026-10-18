# Online recipes and Ask Grimmy — development feature

**Working branch:** `work/grimms-enchanted-kitchen`  
**Status:** Prepared implementation awaiting validation and owner approval to commit. This adds no database migrations or background automations.

## What the user sees

**Recipes:** Three paths—manual Add Recipe, **Import from a website**, and **Grimmy, find me one**. The empty collection also offers importing and discovery, making it practical to seed test data.

**Import from a website:** Paste the direct HTTPS link to a supported recipe publisher. Recipe Chaos requests the webpage through an authenticated, size-limited, redirect-blocked endpoint; it extracts recognized Schema.org Recipe metadata into an **editable draft**. Nothing goes to Supabase until the user clicks Save recipe on the **existing** recipe form. Review ingredient lines carefully: imported ingredients are initially unreviewed.

**Grimmy, find me a recipe:** Search by recipe name or try Surprise me with TheMealDB; preview the result and edit it in the same form before saving. **Search the wider web** opens a normal external search, from which a supported source page may be pasted into the importer. It does not claim access to or extraction from all websites.

**Ask Grimmy:** A reusable, page-aware helper in the shared app layout—not separate implementations. It offers distinct shortcuts for Recipes, Weekly Planning, FrostPantry, and Shopping. The search field navigates to recipe discovery with the typed query. Its scope is explicit: useful navigation and recipe discovery, **not** a general AI chatbot.

## Provider and release requirements

TheMealDB's documented developer test API key `1` is used **only** when `NODE_ENV === 'development'`. The server reads `MEALDB_API_KEY` if set; without an appropriate configured key production discovery returns an honest message and links still offer wider-web search. TheMealDB instructs public app releases to use supporter access. Never put keys in client components.

The website previewer intentionally supports a selected allowlist of common recipe publishers. It does **not** fetch arbitrary user-provided hosts, follow redirects, load scripts, fetch images, or save directly. Websites without public Recipe JSON-LD, websites that require browser sessions, redirects, or blocked scrapers may not import automatically.

## Source of truth and guardrails

- Existing `saveRecipeAction` / `buildManualRecipe` remains the **only** recipe persistence workflow.
- Authenticated-only API routes and existing Supabase RLS / household boundaries remain in force.
- Imported ingredient lines are preserved as manual original text; any canonical ingredient selection still needs review.
- The importer does not certify food-safety, gluten-free suitability, allergens, exact quantities, or recipe reliability. The user edits and confirms before saving.
- Manual recipes, saved plans, pantry, shopping, and Meal Brain logic remain unchanged.
- No paid AI provider calls, schema migrations, or automatic changes to inventory/shopping/plans.

## Suggested smoke test

1. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
2. Log in, open `/recipes`, then `/recipes/discover` and search for `chicken` or click Surprise me.
3. Choose a result, inspect ingredient lines and steps, change something, save. Confirm the recipe appears in Recipes.
4. Try `/recipes/import` with a current HTTPS page from Allrecipes or Budget Bytes; if extraction succeeds, edit the draft and save. If it fails, confirm a helpful error appears without a partial saved recipe.
5. Open each of `/recipes`, `/plan`, `/pantry`, `/shopping`. Verify Ask Grimmy changes its suggestions and useful links still reach real features. Try query input in the helper.
6. Confirm Meal Brain can suggest the newly saved recipe, and Shopping is unchanged until separately approved.

## Next improvements

- Add more publishers and a pasted-text fallback for blocked websites, keeping review-before-save.
- Offer ingredient-level verification during imports so conservative pantry matching becomes useful.
- Consider a truly conversational, optional Grimmy layer once provider budget/privacy/AI controls are defined.
