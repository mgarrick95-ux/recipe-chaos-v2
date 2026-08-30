# Recipe Chaos V2 Data Model Proposal

This is a proposed Supabase/Postgres model. Do not create migrations during Phase 0.

Supabase/Postgres is approved as the backend from the beginning. Migrations are the source of truth for schema changes, and Row Level Security must be used appropriately from the first implementation phase. Schema should be introduced incrementally by phase instead of creating every future-ready table immediately.

## Model Principles

- Store user-entered facts separately from inferred or generated suggestions.
- Preserve original human-facing text when parsing ingredients.
- Use canonical ingredients across recipes, inventory, shopping, planning, and intake.
- Keep Manual and Smart planning as views of one weekly plan model.
- Do not duplicate derived shopping or inventory state when it can be calculated from authoritative records.
- Make core data household-aware from day one while keeping product behavior personal-first.
- Initial implementation may assume one owner and one default household.
- Do not build family-management, invitation, roles UI, or SaaS-style multi-user features yet.
- Use deterministic, conservative ingredient normalization first.
- Preserve original human-readable ingredient text and store canonical interpretation separately.

## Core Entities

### profiles

Purpose: App-level user profile linked to auth.

Important fields: `id`, `auth_user_id`, `display_name`, `default_household_id`, `created_at`, `updated_at`.

Relationships: May belong to many households through `household_members`.

Authoritative: User identity and display preferences.

Timing: Required when authentication is added.

### households

Purpose: Scope shared kitchen data without overbuilding SaaS functionality.

Important fields: `id`, `name`, `created_by_profile_id`, `created_at`, `updated_at`.

Relationships: Owns recipes, inventory, plans, shopping items, preferences, and intake sessions.

Authoritative: Household data boundary.

Timing: Required from the first Supabase-backed implementation; default to one household per owner initially.

### household_members

Purpose: Future-ready membership and roles.

Important fields: `id`, `household_id`, `profile_id`, `role`, `created_at`.

Relationships: Joins profiles to households.

Authoritative: Access and ownership rules.

Timing: Minimal from the first household-aware implementation if needed for RLS/access checks; no membership management UI yet.

### canonical_ingredients

Purpose: Small application-owned shared ingredient identity used across all major systems.

Important fields: `id`, `name`, `ingredient_family`, `default_unit`, `storage_category`, `notes`, `created_at`, `updated_at`.

Relationships: Referenced by aliases, recipe ingredients, inventory items, shopping items, and parsed intake items.

Authoritative: Stable ingredient identity, not user-specific quantities.

Timing: Required for deterministic Ingredient Intelligence. Do not seed a huge external taxonomy at this stage.

### ingredient_aliases

Purpose: Map alternate names to canonical ingredients.

Important fields: `id`, `canonical_ingredient_id`, `alias`, `locale`, `source`, `confidence`, `approved_by_profile_id`, `created_at`.

Relationships: Belongs to canonical ingredient.

Authoritative: Approved deterministic or user-reviewed aliases are authoritative; AI/fuzzy aliases are advisory until approved.

Timing: Required for matching and imports.

### recipes

Purpose: Saved recipe records.

Important fields: `id`, `household_id`, `title`, `description`, `source_url`, `servings`, `yield_text`, `role`, `cuisine`, `meal_type`, `is_favorite`, `notes`, `created_by_profile_id`, `created_at`, `updated_at`, `deleted_at`.

Relationships: Has ingredients, steps, tags, plan selections, and feedback.

Authoritative: Saved recipe metadata and user edits.

Timing: Required for Recipes phase.

### recipe_ingredients

Purpose: Ingredients for a recipe with both display and structured forms.

Important fields: `id`, `recipe_id`, `position`, `original_text`, `quantity`, `unit`, `canonical_ingredient_id`, `preparation`, `descriptor`, `optional`, `matching_confidence`, `user_verified`, `created_at`, `updated_at`.

Relationships: Belongs to recipe; optionally references canonical ingredient.

Authoritative: `original_text` and user-verified fields are authoritative. Parser output is advisory until accepted. Canonical links do not replace human-readable text.

Timing: Required for Recipes phase.

### recipe_steps

Purpose: Ordered cooking instructions.

Important fields: `id`, `recipe_id`, `position`, `instruction`, `duration_minutes`, `created_at`, `updated_at`.

Relationships: Belongs to recipe.

Authoritative: User-approved instruction text.

Timing: Required for Recipes and Cook Mode.

### recipe_tags

Purpose: Flexible household-specific labels.

Important fields: `id`, `household_id`, `name`, `created_at`.

Relationships: Connected to recipes through `recipe_tag_assignments`.

Authoritative: User-managed organization.

Timing: Future-ready but useful early.

### inventory_items

Purpose: Current pantry, fridge, freezer, and leftovers state.

Important fields: `id`, `household_id`, `canonical_ingredient_id`, `display_name`, `quantity`, `unit`, `location`, `purchase_date`, `storage_date`, `expiry_date`, `use_soon_status`, `is_out_of_stock`, `is_staple`, `source_type`, `source_id`, `user_overridden`, `notes`, `created_at`, `updated_at`, `deleted_at`.

Relationships: References canonical ingredient when known; may originate from intake.

Authoritative: Current inventory only after manual entry or approved commit.

Timing: Required for FrostPantry.

### inventory_events

Purpose: Simple provenance/history trail for inventory changes.

Important fields: `id`, `household_id`, `inventory_item_id`, `event_type`, `quantity_delta`, `previous_value`, `new_value`, `source_type`, `source_id`, `created_by_profile_id`, `created_at`.

Relationships: Belongs to inventory item and household.

Authoritative: History, not current state. It should make manual changes and future receipt/photo/meal-driven changes traceable and recoverable without becoming a complex accounting ledger.

Timing: Approved for the first inventory implementation.

### meal_plans

Purpose: One flexible weekly planning container.

Important fields: `id`, `household_id`, `plan_start_date`, `plan_end_date`, `status`, `created_by_profile_id`, `created_at`, `updated_at`.

Relationships: Has planning context and selections.

Authoritative: Weekly plan identity and lifecycle.

Timing: Required for Weekly Planning.

### weekly_planning_contexts

Purpose: User's stated weekly constraints and preferences.

Important fields: `id`, `meal_plan_id`, `meal_count`, `energy_level`, `mood_text`, `desired_food_style`, `budget_mode`, `max_cooking_time_minutes`, `effort_level`, `notes`, `created_at`, `updated_at`.

Relationships: One context per meal plan version or latest context per meal plan.

Authoritative: User-stated planning inputs.

Timing: Required for assisted planning.

### meal_plan_slots

Purpose: Flexible meal positions such as Meal 1, Meal 2, Meal 3.

Important fields: `id`, `meal_plan_id`, `position`, `label`, `status`, `locked`, `created_at`, `updated_at`.

Relationships: Has a selected recipe or suggestion state through selections.

Authoritative: Slot structure for the week.

Timing: Required for Manual and Smart planning.

### meal_plan_selections

Purpose: Committed user-approved meal choices for slots.

Important fields: `id`, `meal_plan_slot_id`, `recipe_id`, `selection_source`, `accepted_suggestion_id`, `manual_note`, `created_by_profile_id`, `created_at`, `updated_at`.

Relationships: Belongs to slot; references recipe and optional suggestion.

Authoritative: Actual weekly plan selections.

Timing: Required for Weekly Planning.

### meal_suggestions

Purpose: Non-authoritative Meal Brain proposals if persisted snapshots become necessary.

Important fields: `id`, `meal_plan_id`, `slot_id`, `recipe_id`, `rank`, `score`, `reason_summary`, `missing_ingredient_count`, `estimated_cost`, `overlap_score`, `status`, `created_at`.

Relationships: May become a meal plan selection after approval.

Authoritative: Never authoritative for the plan until accepted. Scores and explanations should be transient by default; persist compact snapshots only if needed for debugging or recommendation history.

Timing: Future-ready for Meal Brain; not required for initial manual planning.

### shopping_items

Purpose: One visible shopping list with internal source tracking.

Important fields: `id`, `household_id`, `display_name`, `canonical_ingredient_id`, `quantity`, `unit`, `source_type`, `source_id`, `intention`, `checked`, `checked_at`, `manually_added`, `keep_separate`, `inventory_match_status`, `notes`, `created_at`, `updated_at`, `deleted_at`.

Relationships: May reference canonical ingredient, meal plan, recipe ingredient, inventory review, or manual source.

Authoritative: Current shopping list item.

Timing: Required for Shopping phase.

### intake_sessions

Purpose: Capture/import workflow container.

Important fields: `id`, `household_id`, `source_type`, `source_uri`, `raw_text`, `raw_file_path`, `status`, `parser_version`, `created_by_profile_id`, `created_at`, `updated_at`.

Relationships: Has parsed intake items.

Authoritative: Raw source and review workflow state.

Timing: Required for receipts, photos, URLs, PDFs, and pasted imports.

### parsed_intake_items

Purpose: Proposed records extracted from an intake session.

Important fields: `id`, `intake_session_id`, `position`, `raw_text`, `proposed_display_name`, `quantity`, `unit`, `canonical_ingredient_id`, `confidence`, `review_status`, `reviewed_by_profile_id`, `committed_entity_type`, `committed_entity_id`, `created_at`, `updated_at`.

Relationships: Belongs to intake session; may commit to inventory, recipes, or shopping.

Authoritative: Advisory until reviewed and committed.

Timing: Required for Intake.

### household_preferences

Purpose: Explicit likes, dislikes, dietary needs, and defaults.

Important fields: `id`, `household_id`, `preference_type`, `target_type`, `target_id`, `free_text`, `strength`, `source`, `created_at`, `updated_at`.

Relationships: May reference ingredients, recipes, cuisines, or tags.

Authoritative: User-entered preferences are authoritative; learned preferences are suggestions unless promoted.

Timing: Useful before Meal Brain; can start simple.

### feedback_events

Purpose: Learning signals from approvals, rejections, swaps, cooked meals, skipped meals, and edits.

Important fields: `id`, `household_id`, `event_type`, `target_type`, `target_id`, `context_id`, `metadata`, `created_by_profile_id`, `created_at`.

Relationships: References recipes, suggestions, ingredients, plans, or shopping actions by target fields.

Authoritative: Behavioral history, not direct preference truth.

Timing: Future-ready for Learning.

## Do Not Store As Duplicated State

- Separate Manual and Smart weekly plans for the same week.
- Shopping rows that are only UI renderings of recipe ingredients unless they have been explicitly generated or added.
- Inventory quantities inferred from receipts before review.
- Canonical ingredient names copied into every domain record as the matching source of truth.
- Meal Brain scores as committed plan facts.
- Every derived Meal Brain score or explanation unless a compact suggestion snapshot is explicitly justified.
- AI summaries that replace original recipe ingredient text, receipt text, or user notes.
- Duplicate "owned ingredient" flags on recipes when coverage can be calculated from recipe ingredients and inventory.
