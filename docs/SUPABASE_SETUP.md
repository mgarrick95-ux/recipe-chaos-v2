# Supabase Setup

Recipe Chaos V2 must use a new Supabase project. Never point V2 at `recipe-chaos-live-sync` or any older Recipe Chaos database.

## Required Environment Variables

Copy `.env.example` to a local `.env.local` file and fill in values from the new Supabase project:

- `NEXT_PUBLIC_SUPABASE_URL`: public project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable key for browser and RLS-scoped server access.

Do not commit real credentials.

## Applying The Migration

The schema source of truth is `supabase/migrations/`.

For a local Supabase database, apply the migration through the Supabase CLI workflow for this new project only. For a remote database, wait for owner approval before linking a project or pushing migrations.

Before applying anywhere, verify:

- The target project is a new Recipe Chaos V2 project.
- The target project is not `recipe-chaos-live-sync`.
- No old Recipe Chaos credentials are present in `.env.local`.

## First User And Default Household

Phase 1B does not include login, signup, or account UI. Create a test user through the Supabase dashboard or approved local Supabase auth tooling.

After the user authenticates through future UI/server code, call the server-only `ensureDefaultHousehold()` helper. It invokes the `bootstrap_default_household()` database function, which is idempotent and creates exactly the user's initial foundation records when missing:

- one `profiles` row tied to `auth.users.id`
- one default `households` row
- one owner `household_members` row

The bootstrap function uses `auth.uid()` inside the database. The client does not provide the owner id, so household ownership cannot be spoofed by request payload.

## RLS Verification

After applying the migration in a safe target:

1. Sign in as test user A and run the bootstrap helper.
2. Confirm user A can read only their own `profiles` row.
3. Confirm user A can read their default household and membership.
4. Create/sign in as test user B and run the bootstrap helper.
5. Confirm user B cannot read user A's profile, household, or membership.
6. Confirm unauthenticated/anonymous requests cannot read or write application-owned rows.

The foundation policies intentionally avoid blanket `USING (true)` or `WITH CHECK (true)`.

## Before Phase 2

Check that:

- TypeScript, lint, production build, and a home-route smoke test pass.
- The migration has only `profiles`, `households`, and `household_members`.
- RLS is enabled for every application-owned table.
- Default household bootstrap is idempotent for repeated calls.
- No product feature tables, routes, or UI have been added.
