-- Phase 3B: manual recipes. No parsing, tags, or future planning metadata.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (title ~ '[^[:space:]]'),
  description text,
  source_url text,
  servings numeric check (servings > 0 and servings < 'Infinity'::numeric),
  yield_text text,
  is_favorite boolean not null default false,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_household_id_idx on public.recipes(household_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position >= 0),
  original_text text not null check (original_text ~ '[^[:space:]]'),
  ingredient_text text not null check (ingredient_text ~ '[^[:space:]]'),
  quantity text,
  unit text,
  descriptor text,
  preparation text,
  optional boolean not null default false,
  canonical_ingredient_id uuid references public.canonical_ingredients(id) on delete restrict,
  verification_state text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_ingredients_verification_state_check
    check (verification_state in ('unreviewed', 'verified', 'needs_review')),
  constraint recipe_ingredients_unreviewed_unlinked_check
    check (verification_state <> 'unreviewed' or canonical_ingredient_id is null),
  constraint recipe_ingredients_recipe_position_key
    unique (recipe_id, position) deferrable initially deferred
);
create index recipe_ingredients_canonical_id_idx
  on public.recipe_ingredients(canonical_ingredient_id);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null check (position >= 0),
  instruction text not null check (instruction ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_steps_recipe_position_key
    unique (recipe_id, position) deferrable initially deferred
);

-- Grants also exclude immutable update columns. Triggers protect ownership even
-- if a future migration accidentally broadens column grants.
create function public.guard_recipe_immutable_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Recipe identity and creation time are immutable' using errcode = '23514';
  end if;
  if tg_table_name = 'recipes' then
    if new.household_id is distinct from old.household_id
      or new.created_by is distinct from old.created_by then
      raise exception 'Recipe ownership is immutable' using errcode = '23514';
    end if;
    -- Run after set_updated_at. A fresh, monotonic aggregate token also covers
    -- multiple writes in one transaction and transactions started out of order.
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  elsif new.recipe_id is distinct from old.recipe_id then
    raise exception 'Recipe children cannot be reparented' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_recipe_immutable_fields() from public, anon, authenticated;

-- BEFORE child mutation serializes aggregate writers on the parent row.
-- During parent ON DELETE CASCADE the parent is gone and this is a safe no-op.
create function public.touch_recipe_parent()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare parent_id uuid;
begin
  if tg_op = 'DELETE' then parent_id := old.recipe_id;
  else parent_id := new.recipe_id;
  end if;
  update public.recipes set title = title where id = parent_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.touch_recipe_parent() from public, anon, authenticated;

create trigger recipes_set_updated_at before update on public.recipes
for each row execute function public.set_updated_at();
create trigger z_recipes_immutable before update on public.recipes
for each row execute function public.guard_recipe_immutable_fields();
alter table public.recipes enable row level security;
create policy recipes_select on public.recipes for select to authenticated using (public.is_household_member(household_id));
create policy recipes_insert on public.recipes for insert to authenticated with check (public.is_household_member(household_id) and created_by = (select auth.uid()));
create policy recipes_update on public.recipes for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy recipes_delete on public.recipes for delete to authenticated using (public.is_household_member(household_id));
revoke all privileges on table public.recipes from public, anon, authenticated;
grant select, delete on table public.recipes to authenticated;
grant insert (household_id, title, description, source_url, servings, yield_text, is_favorite, notes, created_by) on public.recipes to authenticated;
grant update (title, description, source_url, servings, yield_text, is_favorite, notes) on public.recipes to authenticated;

create trigger recipe_ingredients_set_updated_at before update on public.recipe_ingredients
for each row execute function public.set_updated_at();
create trigger z_recipe_ingredients_immutable before update on public.recipe_ingredients
for each row execute function public.guard_recipe_immutable_fields();
alter table public.recipe_ingredients enable row level security;
create policy recipe_ingredients_select on public.recipe_ingredients for select to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_ingredients_insert on public.recipe_ingredients for insert to authenticated with check (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_ingredients_update on public.recipe_ingredients for update to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id))) with check (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_ingredients_delete on public.recipe_ingredients for delete to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and public.is_household_member(r.household_id)));
revoke all privileges on table public.recipe_ingredients from public, anon, authenticated;
grant select, delete on table public.recipe_ingredients to authenticated;
grant insert (recipe_id, position, original_text, ingredient_text, quantity, unit, descriptor, preparation, optional, canonical_ingredient_id, verification_state) on public.recipe_ingredients to authenticated;
grant update (position, original_text, ingredient_text, quantity, unit, descriptor, preparation, optional, canonical_ingredient_id, verification_state) on public.recipe_ingredients to authenticated;
create trigger recipe_ingredients_touch_parent before insert or update or delete on public.recipe_ingredients
for each row execute function public.touch_recipe_parent();

create trigger recipe_steps_set_updated_at before update on public.recipe_steps
for each row execute function public.set_updated_at();
create trigger z_recipe_steps_immutable before update on public.recipe_steps
for each row execute function public.guard_recipe_immutable_fields();
alter table public.recipe_steps enable row level security;
create policy recipe_steps_select on public.recipe_steps for select to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_steps_insert on public.recipe_steps for insert to authenticated with check (exists (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_steps_update on public.recipe_steps for update to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and public.is_household_member(r.household_id))) with check (exists (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and public.is_household_member(r.household_id)));
create policy recipe_steps_delete on public.recipe_steps for delete to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and public.is_household_member(r.household_id)));
revoke all privileges on table public.recipe_steps from public, anon, authenticated;
grant select, delete on table public.recipe_steps to authenticated;
grant insert (recipe_id, position, instruction) on public.recipe_steps to authenticated;
grant update (position, instruction) on public.recipe_steps to authenticated;
create trigger recipe_steps_touch_parent before insert or update or delete on public.recipe_steps
for each row execute function public.touch_recipe_parent();

-- Full aggregate snapshot: arrays are mandatory; omission of an existing child
-- deletes it. Existing children carry IDs, new children omit IDs. No client IDs
-- are accepted for new rows. Returns the parent ID and exact concurrency token;
-- callers reload the aggregate to obtain generated child IDs. Each existing row
-- carries its full structured fields and canonical decision; the domain constructs
-- that snapshot without requiring duplicate user entry. An omitted ingredient_text
-- mirrors original_text on INSERT only and preserves the stored name on UPDATE.
create function public.save_recipe(
  p_household_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb,
  p_recipe_id uuid default null,
  p_expected_updated_at timestamptz default null
)
returns table (recipe_id uuid, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  saved_id uuid;
  current_updated_at timestamptz;
  item jsonb;
  child_id uuid;
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception 'Household access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_recipe) is distinct from 'object'
    or jsonb_typeof(p_ingredients) is distinct from 'array'
    or jsonb_typeof(p_steps) is distinct from 'array' then
    raise exception 'Recipe object and complete child arrays are required' using errcode = '22023';
  end if;
  set constraints public.recipe_ingredients_recipe_position_key,
    public.recipe_steps_recipe_position_key deferred;
  if p_recipe_id is null then
    if p_expected_updated_at is not null then
      raise exception 'New recipes cannot have an expected timestamp' using errcode = '22023';
    end if;
    insert into public.recipes (household_id, title, description, source_url, servings,
      yield_text, is_favorite, notes, created_by)
    values (p_household_id, p_recipe->>'title', p_recipe->>'description',
      p_recipe->>'source_url', (p_recipe->>'servings')::numeric,
      p_recipe->>'yield_text', coalesce((p_recipe->>'is_favorite')::boolean, false),
      p_recipe->>'notes', auth.uid()) returning id into saved_id;
  else
    select r.updated_at into current_updated_at from public.recipes r
    where r.id = p_recipe_id and r.household_id = p_household_id for update;
    if not found then
      raise exception 'Recipe not found' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is null or current_updated_at <> p_expected_updated_at then
      raise exception 'Recipe changed; reload before saving' using errcode = '40001';
    end if;
    saved_id := p_recipe_id;
    update public.recipes set title = p_recipe->>'title', description = p_recipe->>'description',
      source_url = p_recipe->>'source_url', servings = (p_recipe->>'servings')::numeric,
      yield_text = p_recipe->>'yield_text',
      is_favorite = coalesce((p_recipe->>'is_favorite')::boolean, false), notes = p_recipe->>'notes'
    where id = saved_id;
  end if;

  -- Validate all supplied IDs before removing omitted rows. RLS-hidden IDs
  -- fail identically to unknown IDs. Duplicates never become repeated updates.
  for item in select value from jsonb_array_elements(p_ingredients) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Ingredient must be an object' using errcode = '22023';
    end if;
    child_id := (item->>'id')::uuid;
    if child_id is not null and not (item ?& array[
      'position', 'original_text', 'quantity', 'unit', 'descriptor', 'preparation',
      'optional', 'canonical_ingredient_id', 'verification_state'
    ]) then
      raise exception 'Existing ingredients require a complete content and decision snapshot'
        using errcode = '22023';
    end if;
    if child_id is not null and not exists (
      select 1 from public.recipe_ingredients i where i.id = child_id and i.recipe_id = saved_id
    ) then raise exception 'Invalid ingredient ID' using errcode = '22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Step must be an object' using errcode = '22023';
    end if;
    child_id := (item->>'id')::uuid;
    if child_id is not null and not exists (
      select 1 from public.recipe_steps s where s.id = child_id and s.recipe_id = saved_id
    ) then raise exception 'Invalid step ID' using errcode = '22023'; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_ingredients) e
    where e->>'id' is not null group by (e->>'id')::uuid having count(*) > 1)
    or exists (select 1 from jsonb_array_elements(p_steps) e
    where e->>'id' is not null group by (e->>'id')::uuid having count(*) > 1) then
    raise exception 'Duplicate child IDs' using errcode = '22023';
  end if;

  delete from public.recipe_ingredients i where i.recipe_id = saved_id and not exists (
    select 1 from jsonb_array_elements(p_ingredients) e where (e->>'id')::uuid = i.id
  );
  delete from public.recipe_steps s where s.recipe_id = saved_id and not exists (
    select 1 from jsonb_array_elements(p_steps) e where (e->>'id')::uuid = s.id
  );

  for item in select value from jsonb_array_elements(p_ingredients) loop
    child_id := (item->>'id')::uuid;
    if child_id is null then
      insert into public.recipe_ingredients (recipe_id, position, original_text, ingredient_text,
        quantity, unit, descriptor, preparation, optional, canonical_ingredient_id, verification_state)
      values (saved_id, (item->>'position')::integer, item->>'original_text',
        coalesce(item->>'ingredient_text', item->>'original_text'), item->>'quantity', item->>'unit',
        item->>'descriptor', item->>'preparation', coalesce((item->>'optional')::boolean, false),
        (item->>'canonical_ingredient_id')::uuid, coalesce(item->>'verification_state', 'unreviewed'));
    else
      update public.recipe_ingredients set position = (item->>'position')::integer,
        original_text = item->>'original_text',
        ingredient_text = coalesce(item->>'ingredient_text', recipe_ingredients.ingredient_text),
        quantity = item->>'quantity', unit = item->>'unit', descriptor = item->>'descriptor',
        preparation = item->>'preparation', optional = coalesce((item->>'optional')::boolean, false),
        canonical_ingredient_id = (item->>'canonical_ingredient_id')::uuid,
        verification_state = coalesce(item->>'verification_state', 'unreviewed')
      where id = child_id and recipe_ingredients.recipe_id = saved_id;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_steps) loop
    child_id := (item->>'id')::uuid;
    if child_id is null then
      insert into public.recipe_steps (recipe_id, position, instruction)
      values (saved_id, (item->>'position')::integer, item->>'instruction');
    else
      update public.recipe_steps set position = (item->>'position')::integer,
        instruction = item->>'instruction'
      where id = child_id and recipe_steps.recipe_id = saved_id;
    end if;
  end loop;
  -- Check final ordering before reporting success, including when called inside
  -- a longer transaction. Errors roll back this function's entire statement.
  set constraints public.recipe_ingredients_recipe_position_key,
    public.recipe_steps_recipe_position_key immediate;
  return query select r.id, r.updated_at from public.recipes r where r.id = saved_id;
end;
$$;
revoke all on function public.save_recipe(uuid, jsonb, jsonb, jsonb, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_recipe(uuid, jsonb, jsonb, jsonb, uuid, timestamptz)
  to authenticated;
