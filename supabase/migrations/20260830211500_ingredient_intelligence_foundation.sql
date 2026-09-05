create table public.canonical_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_ingredients_name_not_blank check (length(btrim(name)) > 0),
  constraint canonical_ingredients_normalized_name_not_blank check (length(btrim(normalized_name)) > 0),
  constraint canonical_ingredients_normalized_name_unique unique (normalized_name)
);

create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_ingredient_id uuid not null references public.canonical_ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null,
  household_id uuid references public.households(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ingredient_aliases_alias_not_blank check (length(btrim(alias)) > 0),
  constraint ingredient_aliases_normalized_alias_not_blank check (length(btrim(normalized_alias)) > 0),
  constraint ingredient_aliases_source_allowed check (source in ('app_seed', 'owner_approved')),
  constraint ingredient_aliases_global_seed_shape check (
    (household_id is null and created_by is null and source = 'app_seed')
    or (household_id is not null and created_by is not null and source = 'owner_approved')
  )
);

create table public.ingredient_separation_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  normalized_input text not null,
  blocked_canonical_ingredient_id uuid not null references public.canonical_ingredients(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ingredient_separation_rules_normalized_input_not_blank check (length(btrim(normalized_input)) > 0),
  constraint ingredient_separation_rules_unique unique (
    household_id,
    normalized_input,
    blocked_canonical_ingredient_id
  )
);

create unique index ingredient_aliases_global_normalized_alias_unique
on public.ingredient_aliases (normalized_alias)
where household_id is null;

create unique index ingredient_aliases_household_normalized_alias_unique
on public.ingredient_aliases (household_id, normalized_alias)
where household_id is not null;

create index ingredient_aliases_canonical_ingredient_id_idx
on public.ingredient_aliases (canonical_ingredient_id);

create index ingredient_aliases_household_id_idx
on public.ingredient_aliases (household_id);

create index ingredient_separation_rules_household_id_idx
on public.ingredient_separation_rules (household_id);

create trigger canonical_ingredients_set_updated_at
before update on public.canonical_ingredients
for each row execute function public.set_updated_at();

alter table public.canonical_ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.ingredient_separation_rules enable row level security;

create policy "Authenticated users can view canonical ingredients"
on public.canonical_ingredients
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "Authenticated users can view available ingredient aliases"
on public.ingredient_aliases
for select
to authenticated
using (
  household_id is null
  or public.is_household_member(household_id)
);

create policy "Household members can create household ingredient aliases"
on public.ingredient_aliases
for insert
to authenticated
with check (
  household_id is not null
  and public.is_household_member(household_id)
  and created_by = (select auth.uid())
  and source = 'owner_approved'
);

create policy "Household members can update household ingredient aliases"
on public.ingredient_aliases
for update
to authenticated
using (
  household_id is not null
  and public.is_household_member(household_id)
  and created_by = (select auth.uid())
)
with check (
  household_id is not null
  and public.is_household_member(household_id)
  and created_by = (select auth.uid())
  and source = 'owner_approved'
);

create policy "Household members can delete household ingredient aliases"
on public.ingredient_aliases
for delete
to authenticated
using (
  household_id is not null
  and public.is_household_member(household_id)
  and created_by = (select auth.uid())
);

create policy "Household members can view ingredient separation rules"
on public.ingredient_separation_rules
for select
to authenticated
using (public.is_household_member(household_id));

create policy "Household members can create ingredient separation rules"
on public.ingredient_separation_rules
for insert
to authenticated
with check (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
);

create policy "Household members can update ingredient separation rules"
on public.ingredient_separation_rules
for update
to authenticated
using (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
)
with check (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
);

create policy "Household members can delete ingredient separation rules"
on public.ingredient_separation_rules
for delete
to authenticated
using (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
);

revoke all privileges on table public.canonical_ingredients from anon;
revoke all privileges on table public.ingredient_aliases from anon;
revoke all privileges on table public.ingredient_separation_rules from anon;

revoke all privileges on table public.canonical_ingredients from authenticated;
revoke all privileges on table public.ingredient_aliases from authenticated;
revoke all privileges on table public.ingredient_separation_rules from authenticated;

grant select on table public.canonical_ingredients to authenticated;
grant select, insert, update, delete on table public.ingredient_aliases to authenticated;
grant select, insert, update, delete on table public.ingredient_separation_rules to authenticated;

with seed_ingredients (name, normalized_name) as (
  values
    ('garlic', 'garlic'),
    ('garlic powder', 'garlic powder'),
    ('fresh ginger', 'fresh ginger'),
    ('ground ginger', 'ground ginger'),
    ('brown sugar', 'brown sugar'),
    ('granulated sugar', 'granulated sugar'),
    ('milk', 'milk'),
    ('almond milk', 'almond milk'),
    ('butter', 'butter'),
    ('margarine', 'margarine'),
    ('salt', 'salt'),
    ('black pepper', 'black pepper'),
    ('olive oil', 'olive oil'),
    ('onion', 'onion'),
    ('egg', 'egg')
)
insert into public.canonical_ingredients (name, normalized_name)
select name, normalized_name
from seed_ingredients
on conflict (normalized_name) do nothing;

with seed_aliases (alias, normalized_alias, canonical_name) as (
  values
    ('garlic cloves', 'garlic cloves', 'garlic'),
    ('cloves of garlic', 'cloves of garlic', 'garlic'),
    ('white sugar', 'white sugar', 'granulated sugar'),
    ('dairy milk', 'dairy milk', 'milk'),
    ('cow''s milk', 'cow''s milk', 'milk')
)
insert into public.ingredient_aliases (
  canonical_ingredient_id,
  alias,
  normalized_alias,
  source,
  household_id,
  created_by
)
select
  ci.id,
  sa.alias,
  sa.normalized_alias,
  'app_seed',
  null,
  null
from seed_aliases sa
join public.canonical_ingredients ci
  on ci.normalized_name = sa.canonical_name
on conflict (normalized_alias)
where household_id is null
do nothing;
