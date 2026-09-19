-- Review-first Weekly Plan -> Shopping handoff.
-- Preview rows stay transient. These columns preserve the exact approved origin
-- of durable plan-generated shopping rows and support active-row idempotency.
alter table public.shopping_items
  add column source_slot_id uuid,
  add column source_recipe_ingredient_id uuid,
  add constraint shopping_items_source_shape_check check (
    (source_type = 'manual' and source_id is null
      and source_slot_id is null and source_recipe_ingredient_id is null)
    or
    (source_type = 'plan' and source_id is not null
      and source_slot_id is not null and source_recipe_ingredient_id is not null)
  );

create unique index shopping_items_active_plan_origin_unique
on public.shopping_items (
  household_id, source_id, source_slot_id, source_recipe_ingredient_id
)
where source_type = 'plan' and deleted_at is null;

create or replace function public.guard_shopping_immutable_fields()
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
    or new.source_id is distinct from old.source_id
    or new.source_slot_id is distinct from old.source_slot_id
    or new.source_recipe_ingredient_id is distinct from old.source_recipe_ingredient_id then
    raise exception 'Shopping identity and source are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_shopping_immutable_fields() from public, anon, authenticated;

-- Validate plan provenance and derive content from authoritative recipe data.
-- This also protects the table if a caller attempts a direct plan-row insert.
create function public.prepare_plan_shopping_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved record;
begin
  if new.source_type <> 'plan' then
    return new;
  end if;

  select p.household_id, ri.original_text, ri.canonical_ingredient_id,
    ri.verification_state
  into resolved
  from public.meal_plans p
  join public.meal_plan_slots s
    on s.meal_plan_id = p.id and s.id = new.source_slot_id
  join public.meal_plan_selections selection
    on selection.meal_plan_slot_id = s.id
  join public.recipe_ingredients ri
    on ri.recipe_id = selection.recipe_id
      and ri.id = new.source_recipe_ingredient_id
  where p.id = new.source_id
    and public.is_household_member(p.household_id);

  if not found
    or resolved.household_id is distinct from new.household_id
    or new.created_by is distinct from (select auth.uid()) then
    raise exception 'Plan shopping origin is unavailable' using errcode = '22023';
  end if;

  new.display_name := resolved.original_text;
  new.canonical_ingredient_id := case
    when resolved.verification_state = 'verified'
      then resolved.canonical_ingredient_id
    else null
  end;
  -- Recipe quantities are intentionally not parsed or converted in this phase.
  new.quantity := null;
  new.unit := null;
  new.intention := 'this_week';
  new.is_checked := false;
  return new;
end;
$$;
revoke all on function public.prepare_plan_shopping_item() from public, anon, authenticated;

create trigger shopping_items_prepare_plan
before insert on public.shopping_items
for each row execute function public.prepare_plan_shopping_item();

create policy shopping_items_plan_insert
on public.shopping_items for insert to authenticated
with check (
  source_type = 'plan'
  and source_id is not null
  and source_slot_id is not null
  and source_recipe_ingredient_id is not null
  and created_by = (select auth.uid())
  and public.is_household_member(household_id)
  and exists (
    select 1
    from public.meal_plans p
    join public.meal_plan_slots s
      on s.meal_plan_id = p.id and s.id = source_slot_id
    join public.meal_plan_selections selection
      on selection.meal_plan_slot_id = s.id
    join public.recipe_ingredients ri
      on ri.recipe_id = selection.recipe_id
        and ri.id = source_recipe_ingredient_id
    where p.id = source_id
      and p.household_id = shopping_items.household_id
  )
);

grant insert (source_slot_id, source_recipe_ingredient_id)
on public.shopping_items to authenticated;

-- The caller supplies identities only. Every origin is revalidated inside the
-- transaction, and the partial unique index makes retries/concurrency no-ops.
create function public.add_plan_shopping_items(
  p_plan_id uuid,
  p_origins jsonb
)
returns table (
  slot_id uuid,
  recipe_ingredient_id uuid,
  outcome text,
  shopping_item_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  requested_slot_id uuid;
  requested_ingredient_id uuid;
  plan_household_id uuid;
  inserted_id uuid;
begin
  if (select auth.uid()) is null
    or jsonb_typeof(p_origins) is distinct from 'array'
    or jsonb_array_length(p_origins) > 200 then
    raise exception 'Invalid plan shopping request' using errcode = '22023';
  end if;

  select p.household_id into plan_household_id
  from public.meal_plans p
  where p.id = p_plan_id
    and public.is_household_member(p.household_id);
  if plan_household_id is null then
    raise exception 'Plan is unavailable' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_origins)
  loop
    begin
      requested_slot_id := nullif(item->>'slot_id', '')::uuid;
      requested_ingredient_id := nullif(item->>'recipe_ingredient_id', '')::uuid;
    exception when invalid_text_representation then
      requested_slot_id := null;
      requested_ingredient_id := null;
    end;

    slot_id := requested_slot_id;
    recipe_ingredient_id := requested_ingredient_id;
    shopping_item_id := null;

    if requested_slot_id is null or requested_ingredient_id is null
      or not exists (
        select 1
        from public.meal_plan_slots s
        join public.meal_plan_selections selection
          on selection.meal_plan_slot_id = s.id
        join public.recipe_ingredients ri
          on ri.recipe_id = selection.recipe_id
            and ri.id = requested_ingredient_id
        where s.id = requested_slot_id
          and s.meal_plan_id = p_plan_id
      ) then
      outcome := 'stale_or_invalid';
      return next;
      continue;
    end if;

    inserted_id := null;
    insert into public.shopping_items (
      household_id, display_name, intention, source_type, source_id,
      source_slot_id, source_recipe_ingredient_id, created_by
    ) values (
      plan_household_id, 'Planned ingredient', 'this_week', 'plan', p_plan_id,
      requested_slot_id, requested_ingredient_id, (select auth.uid())
    )
    on conflict (
      household_id, source_id, source_slot_id, source_recipe_ingredient_id
    ) where source_type = 'plan' and deleted_at is null
    do nothing
    returning id into inserted_id;

    if inserted_id is null then
      select si.id into shopping_item_id
      from public.shopping_items si
      where si.household_id = plan_household_id
        and si.source_type = 'plan'
        and si.source_id = p_plan_id
        and si.source_slot_id = requested_slot_id
        and si.source_recipe_ingredient_id = requested_ingredient_id
        and si.deleted_at is null;
      outcome := 'already_plan';
    else
      shopping_item_id := inserted_id;
      outcome := 'added';
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.add_plan_shopping_items(uuid, jsonb) from public, anon;
grant execute on function public.add_plan_shopping_items(uuid, jsonb) to authenticated;
