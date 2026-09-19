-- Shopping checkpoint: one household list. Plan-derived entries will use the
-- same table after the weekly-plan workflow is approved and implemented.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  canonical_ingredient_id uuid references public.canonical_ingredients(id) on delete restrict,
  display_name text not null check (display_name ~ '[^[:space:]]'),
  quantity numeric check (quantity is null or (quantity >= 0 and quantity < 'Infinity'::numeric)),
  unit text,
  intention text not null default 'general' check (intention in ('general', 'this_week', 'staple')),
  source_type text not null default 'manual' check (source_type in ('manual', 'plan')),
  source_id uuid,
  is_checked boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shopping_items_household_active_idx
  on public.shopping_items(household_id, is_checked, created_at)
  where deleted_at is null;

create function public.guard_shopping_immutable_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.household_id is distinct from old.household_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id then
    raise exception 'Shopping identity and source are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_shopping_immutable_fields() from public, anon, authenticated;

create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row execute function public.set_updated_at();

create trigger shopping_items_immutable
before update on public.shopping_items
for each row execute function public.guard_shopping_immutable_fields();

alter table public.shopping_items enable row level security;

create policy shopping_items_select
on public.shopping_items for select to authenticated
using (public.is_household_member(household_id));

create policy shopping_items_insert
on public.shopping_items for insert to authenticated
with check (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
  and source_type = 'manual'
  and source_id is null
);

create policy shopping_items_update
on public.shopping_items for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

revoke all privileges on table public.shopping_items from public, anon, authenticated;
grant select on table public.shopping_items to authenticated;
grant insert (
  household_id, canonical_ingredient_id, display_name, quantity, unit,
  intention, source_type, source_id, created_by
) on public.shopping_items to authenticated;
grant update (
  canonical_ingredient_id, display_name, quantity, unit, intention,
  is_checked, deleted_at
) on public.shopping_items to authenticated;
