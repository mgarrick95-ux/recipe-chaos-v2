# Online recipes and Ask Grimmy — development feature

**Working branch:** `work/grimms-enchanted-kitchen`  
**Status:** Development feature; web-import connectivity diagnostics and WP Recipe Maker print-card support are being refined. This adds no database migrations or background automations.

## What the user sees

**Recipes:** Three paths—manual Add Recipe, **Import from a website**, and **Grimmy, find me one**. The empty collection also offers importing and discovery, making it practical to seed test data.

**Import from a website:** Paste the direct HTTPS link from almost any publicly accessible recipe website. Recipe Chaos checks DNS addresses, pins a vetted public IPv4 address for TLS requests, rechecks up to three HTTPS redirects, and bounds the HTML size and request duration. It extracts recognized Schema.org Recipe metadata (or recognizable WP Recipe Maker recipe-card fields in print views) into an **editable draft**. Nothing goes to Supabase until the user clicks Save recipe on the **existing** recipe form. Imported ingredients are initially unreviewed.

**Grimmy, find me a recipe:** Search by recipe name or try Surprise me with TheMealDB; preview the result and edit it in the same form before saving. **Search the wider web** opens a normal external search, from which a public HTTPS recipe page may be brought back to the importer. It does not claim access to or extraction from all websites.

**Ask Grimmy:** A reusable, page-aware helper in the shared app layout—not separate implementations. It offers distinct shortcuts for Recipes, Weekly Planning, FrostPantry, and Shopping. The search field navigates to recipe discovery with the typed query. Its scope is explicit: useful navigation and recipe discovery, **not** a general AI chatbot.

## Provider and release requirements

TheMealDB's documented developer test API key `1` is used **only** when `NODE_ENV === 'development'`. The server reads `MEALDB_API_KEY` if set; without an appropriate configured key production discovery returns an honest message and links still offer wider-web search. TheMealDB instructs public app releases to use supporter access. Never put keys in client components.

The website previewer accepts ordinary public HTTPS hostnames without a publisher allowlist. The server rejects local hostnames, numeric IP hostnames, private/special IPv4 DNS answers, custom ports and credentials. It connects over TLS with certificate verification while **pinning the validated public IPv4**, preventing DNS rebinding. It follows at most three redirects, checking every new hostname and DNS answer. It rejects oversized or non-HTML results and does **not** execute scripts, fetch images, or save directly. Network requests use the platform DNS resolver, but verified addresses are still pinned to the HTTPS socket. Error messages distinguish DNS failures, TLS/connectivity failures, site refusal (401/403), rate limiting (429), and missing pages (404). IPv6-only websites and websites that block server-side requests may still fail; this is intentional for now. Pages without readable Recipe JSON-LD will also fail.

**Paste-text fallback:** On the same import page, users can copy a recipe with Ingredients and Instructions/Method headings. A local deterministic parser creates an editable recipe draft. Ingredients and directions remain distinct; when headings are unclear the parser asks for a correction instead of guessing. No server requests, AI usage, or database writes happen until the normal Save Recipe action.

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
4. Try `/recipes/import` with any public HTTPS recipe page, including a food blog not on the old allowlist. Review and save a successful preview; failures should explain what happened without saving anything.
5. Copy a recipe's title, Ingredients and Instructions into the paste-text fallback. Confirm it becomes an editable draft, and check that an ambiguous paste yields a clear error.
6. Open each of `/recipes`, `/plan`, `/pantry`, `/shopping`. Verify Ask Grimmy changes its suggestions and useful links still reach real features. Try query input in the helper.
7. Confirm Meal Brain can suggest the newly saved recipe, and Shopping is unchanged until separately approved.

## Next improvements

- Add optional parsing support for websites that omit Schema.org Recipe JSON-LD, still keeping review-before-save.
- Offer ingredient-level verification during imports so conservative pantry matching becomes useful.
- Consider a truly conversational, optional Grimmy layer once provider budget/privacy/AI controls are defined.
