-- Intentional stale-edit conflicts return HTTP 412 through PostgREST.
-- CREATE OR REPLACE preserves the existing authenticated-only EXECUTE grants.
create or replace function public.save_recipe(
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
      raise exception 'Recipe changed; reload before saving' using errcode = 'PT412';
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
