-- Launch checkpoint 1: FrostPantry manual inventory and provenance.
-- Inventory is household-scoped, manual-first, and soft-deleted so its event
-- history remains traceable. Intake/photo/receipt automation comes later.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  canonical_ingredient_id uuid references public.canonical_ingredients(id) on delete restrict,
  display_name text not null check (display_name ~ '[^[:space:]]'),
  quantity numeric check (quantity is null or (quantity >= 0 and quantity < 'Infinity'::numeric)),
  unit text,
  location text not null default 'pantry',
  purchase_date date,
  storage_date date,
  expiry_date date,
  use_soon_status text not null default 'normal',
  is_out_of_stock boolean not null default false,
  is_staple boolean not null default false,
  source_type text not null default 'manual',
  source_id uuid,
  user_overridden boolean not null default true,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_items_location_check
    check (location in ('pantry', 'fridge', 'freezer', 'leftovers')),
  constraint inventory_items_use_soon_status_check
    check (use_soon_status in ('normal', 'use_soon')),
  constraint inventory_items_source_type_check
    check (source_type in ('manual', 'intake', 'meal', 'system'))
);

create index inventory_items_household_active_idx
  on public.inventory_items(household_id, location, updated_at desc)
  where deleted_at is null;
create index inventory_items_canonical_id_idx
  on public.inventory_items(canonical_ingredient_id)
  where deleted_at is null;
create index inventory_items_use_soon_idx
  on public.inventory_items(household_id, expiry_date)
  where deleted_at is null and use_soon_status = 'use_soon';

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  event_type text not null,
  quantity_delta numeric,
  previous_value jsonb,
  new_value jsonb,
  source_type text not null default 'manual',
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_events_event_type_check
    check (event_type in ('created', 'updated', 'deleted', 'restored')),
  constraint inventory_events_source_type_check
    check (source_type in ('manual', 'intake', 'meal', 'system'))
);

create index inventory_events_item_created_idx
  on public.inventory_events(inventory_item_id, created_at desc);
create index inventory_events_household_created_idx
  on public.inventory_events(household_id, created_at desc);

create function public.guard_inventory_immutable_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.household_id is distinct from old.household_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Inventory identity and ownership are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_inventory_immutable_fields() from public, anon, authenticated;

create function public.log_inventory_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_type text;
  resolved_delta numeric;
begin
  if tg_op = 'INSERT' then
    resolved_type := 'created';
    resolved_delta := new.quantity;
    insert into public.inventory_events (
      household_id, inventory_item_id, event_type, quantity_delta,
      previous_value, new_value, source_type, source_id, created_by
    ) values (
      new.household_id, new.id, resolved_type, resolved_delta,
      null, to_jsonb(new), new.source_type, new.source_id, auth.uid()
    );
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    resolved_type := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    resolved_type := 'restored';
  else
    resolved_type := 'updated';
  end if;

  if old.quantity is not null and new.quantity is not null then
    resolved_delta := new.quantity - old.quantity;
  else
    resolved_delta := null;
  end if;

  insert into public.inventory_events (
    household_id, inventory_item_id, event_type, quantity_delta,
    previous_value, new_value, source_type, source_id, created_by
  ) values (
    new.household_id, new.id, resolved_type, resolved_delta,
    to_jsonb(old), to_jsonb(new), new.source_type, new.source_id, auth.uid()
  );
  return new;
end;
$$;
revoke all on function public.log_inventory_event() from public, anon, authenticated;

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create trigger z_inventory_items_immutable
before update on public.inventory_items
for each row execute function public.guard_inventory_immutable_fields();

create trigger inventory_items_log_event
after insert or update on public.inventory_items
for each row execute function public.log_inventory_event();

alter table public.inventory_items enable row level security;
alter table public.inventory_events enable row level security;

create policy inventory_items_select
on public.inventory_items for select to authenticated
using (public.is_household_member(household_id));

create policy inventory_items_insert
on public.inventory_items for insert to authenticated
with check (
  public.is_household_member(household_id)
  and created_by = (select auth.uid())
);

create policy inventory_items_update
on public.inventory_items for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy inventory_events_select
on public.inventory_events for select to authenticated
using (public.is_household_member(household_id));

revoke all privileges on table public.inventory_items from public, anon, authenticated;
grant select on table public.inventory_items to authenticated;
grant insert (
  household_id, canonical_ingredient_id, display_name, quantity, unit, location,
  purchase_date, storage_date, expiry_date, use_soon_status, is_out_of_stock,
  is_staple, source_type, source_id, user_overridden, notes, created_by
) on public.inventory_items to authenticated;
grant update (
  canonical_ingredient_id, display_name, quantity, unit, location, purchase_date,
  storage_date, expiry_date, use_soon_status, is_out_of_stock, is_staple,
  source_type, source_id, user_overridden, notes, deleted_at
) on public.inventory_items to authenticated;

revoke all privileges on table public.inventory_events from public, anon, authenticated;
grant select on table public.inventory_events to authenticated;
