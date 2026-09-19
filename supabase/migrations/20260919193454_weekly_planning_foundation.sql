create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  plan_start_date date not null,
  plan_end_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, plan_start_date),
  check (plan_end_date = plan_start_date + 6)
);

create table public.weekly_planning_contexts (
  meal_plan_id uuid primary key references public.meal_plans(id) on delete cascade,
  meal_count integer not null check (meal_count between 1 and 14),
  energy_level text,
  budget_mode text,
  max_cooking_time_minutes integer check (max_cooking_time_minutes between 0 and 1440),
  effort_level text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plan_slots (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  position integer not null check (position between 1 and 14),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, position)
);

create table public.meal_plan_selections (
  id uuid primary key default gen_random_uuid(),
  meal_plan_slot_id uuid not null unique references public.meal_plan_slots(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  selection_source text not null default 'manual' check (selection_source in ('manual', 'approved_suggestion')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plans_household_week_idx on public.meal_plans(household_id, plan_start_date desc);
create index meal_plan_selections_recipe_idx on public.meal_plan_selections(recipe_id);

create trigger meal_plans_updated_at before update on public.meal_plans
for each row execute function public.set_updated_at();
create trigger weekly_planning_contexts_updated_at before update on public.weekly_planning_contexts
for each row execute function public.set_updated_at();
create trigger meal_plan_slots_updated_at before update on public.meal_plan_slots
for each row execute function public.set_updated_at();
create trigger meal_plan_selections_updated_at before update on public.meal_plan_selections
for each row execute function public.set_updated_at();

alter table public.meal_plans enable row level security;
alter table public.weekly_planning_contexts enable row level security;
alter table public.meal_plan_slots enable row level security;
alter table public.meal_plan_selections enable row level security;

create policy plan_read on public.meal_plans for select to authenticated
using (public.is_household_member(household_id));
create policy plan_insert on public.meal_plans for insert to authenticated
with check (public.is_household_member(household_id) and created_by = (select auth.uid()));

create policy context_read on public.weekly_planning_contexts for select to authenticated
using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));
create policy context_insert on public.weekly_planning_contexts for insert to authenticated
with check (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));
create policy context_update on public.weekly_planning_contexts for update to authenticated
using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)))
with check (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));

create policy slot_read on public.meal_plan_slots for select to authenticated
using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));
create policy slot_insert on public.meal_plan_slots for insert to authenticated
with check (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));
create policy slot_update on public.meal_plan_slots for update to authenticated
using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)))
with check (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));
create policy slot_delete on public.meal_plan_slots for delete to authenticated
using (exists (select 1 from public.meal_plans p where p.id = meal_plan_id and public.is_household_member(p.household_id)));

create policy selection_read on public.meal_plan_selections for select to authenticated
using (exists (select 1 from public.meal_plan_slots s join public.meal_plans p on p.id = s.meal_plan_id
  where s.id = meal_plan_slot_id and public.is_household_member(p.household_id)));
create policy selection_insert on public.meal_plan_selections for insert to authenticated
with check (created_by = (select auth.uid()) and selection_source = 'manual'
  and exists (select 1 from public.meal_plan_slots s join public.meal_plans p on p.id = s.meal_plan_id
    join public.recipes r on r.id = recipe_id and r.household_id = p.household_id
    where s.id = meal_plan_slot_id and public.is_household_member(p.household_id)));
create policy selection_update on public.meal_plan_selections for update to authenticated
using (exists (select 1 from public.meal_plan_slots s join public.meal_plans p on p.id = s.meal_plan_id
  where s.id = meal_plan_slot_id and public.is_household_member(p.household_id)))
with check (selection_source = 'manual' and exists (select 1 from public.meal_plan_slots s
  join public.meal_plans p on p.id = s.meal_plan_id
  join public.recipes r on r.id = recipe_id and r.household_id = p.household_id
  where s.id = meal_plan_slot_id and public.is_household_member(p.household_id)));
create policy selection_delete on public.meal_plan_selections for delete to authenticated
using (exists (select 1 from public.meal_plan_slots s join public.meal_plans p on p.id = s.meal_plan_id
  where s.id = meal_plan_slot_id and public.is_household_member(p.household_id)));

revoke all on public.meal_plans, public.weekly_planning_contexts,
  public.meal_plan_slots, public.meal_plan_selections from public, anon, authenticated;
grant select on public.meal_plans, public.weekly_planning_contexts,
  public.meal_plan_slots, public.meal_plan_selections to authenticated;
grant insert (household_id, plan_start_date, plan_end_date, created_by) on public.meal_plans to authenticated;
grant insert (meal_plan_id, meal_count) on public.weekly_planning_contexts to authenticated;
grant update (meal_count, energy_level, budget_mode, max_cooking_time_minutes, effort_level, notes)
  on public.weekly_planning_contexts to authenticated;
grant insert (meal_plan_id, position) on public.meal_plan_slots to authenticated;
grant update (locked) on public.meal_plan_slots to authenticated;
grant delete on public.meal_plan_slots to authenticated;
grant insert (meal_plan_slot_id, recipe_id, selection_source, created_by)
  on public.meal_plan_selections to authenticated;
grant update (recipe_id) on public.meal_plan_selections to authenticated;
grant delete on public.meal_plan_selections to authenticated;

-- All plan structure changes happen in one transaction. A smaller count cannot
-- discard a selected or locked meal without the user's explicit remove action.
create function public.save_manual_plan(p_household_id uuid, p_start date, p_count integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_count not between 1 and 14 or extract(isodow from p_start) <> 1
    or not public.is_household_member(p_household_id) then
    raise exception 'Invalid weekly plan' using errcode = '22023';
  end if;
  insert into public.meal_plans (household_id, plan_start_date, plan_end_date, created_by)
  values (p_household_id, p_start, p_start + 6, auth.uid())
  on conflict (household_id, plan_start_date) do nothing;
  select id into v_id from public.meal_plans
  where household_id = p_household_id and plan_start_date = p_start;
  if exists (select 1 from public.meal_plan_slots s
    where s.meal_plan_id = v_id and s.position > p_count
      and (s.locked or exists (select 1 from public.meal_plan_selections c where c.meal_plan_slot_id = s.id))) then
    raise exception 'Remove or unlock meals past the new count first' using errcode = '22023';
  end if;
  delete from public.meal_plan_slots where meal_plan_id = v_id and position > p_count;
  insert into public.meal_plan_slots (meal_plan_id, position)
  select v_id, n from generate_series(1, p_count) n
  on conflict (meal_plan_id, position) do nothing;
  insert into public.weekly_planning_contexts (meal_plan_id, meal_count)
  values (v_id, p_count)
  on conflict (meal_plan_id) do update set meal_count = excluded.meal_count;
  return v_id;
end;
$$;
revoke all on function public.save_manual_plan(uuid, date, integer) from public, anon;
grant execute on function public.save_manual_plan(uuid, date, integer) to authenticated;

create function public.set_manual_plan_recipe(p_slot_id uuid, p_recipe_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_household uuid;
begin
  select p.household_id into v_household from public.meal_plan_slots s
  join public.meal_plans p on p.id = s.meal_plan_id
  where s.id = p_slot_id and not s.locked and public.is_household_member(p.household_id);
  if v_household is null then
    raise exception 'Meal is unavailable or locked' using errcode = '22023';
  end if;
  if p_recipe_id is null then
    delete from public.meal_plan_selections where meal_plan_slot_id = p_slot_id;
  else
    if not exists (select 1 from public.recipes where id = p_recipe_id and household_id = v_household) then
      raise exception 'Recipe is unavailable' using errcode = '22023';
    end if;
    insert into public.meal_plan_selections (meal_plan_slot_id, recipe_id, selection_source, created_by)
    values (p_slot_id, p_recipe_id, 'manual', auth.uid())
    on conflict (meal_plan_slot_id) do update set recipe_id = excluded.recipe_id;
  end if;
end;
$$;
revoke all on function public.set_manual_plan_recipe(uuid, uuid) from public, anon;
grant execute on function public.set_manual_plan_recipe(uuid, uuid) to authenticated;
