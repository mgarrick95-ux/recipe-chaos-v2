create or replace function public.bootstrap_default_household()
returns table (
  user_id uuid,
  profile_id uuid,
  household_id uuid,
  household_name text,
  role public.household_member_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to bootstrap a household'
      using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  select p.default_household_id
  into resolved_household_id
  from public.profiles p
  where p.id = current_user_id;

  if resolved_household_id is null then
    insert into public.households (name, created_by)
    values ('My Household', current_user_id)
    returning households.id into resolved_household_id;

    update public.profiles p
    set default_household_id = resolved_household_id
    where p.id = current_user_id;
  elsif not exists (
    select 1
    from public.household_members hm
    where hm.household_id = resolved_household_id
      and hm.user_id = current_user_id
  ) then
    if not exists (
      select 1
      from public.households h
      where h.id = resolved_household_id
        and h.created_by = current_user_id
    ) then
      insert into public.households (name, created_by)
      values ('My Household', current_user_id)
      returning households.id into resolved_household_id;

      update public.profiles p
      set default_household_id = resolved_household_id
      where p.id = current_user_id;
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (resolved_household_id, current_user_id, 'owner')
  on conflict on constraint household_members_pkey do update
    set role = excluded.role;

  return query
  select
    current_user_id,
    current_user_id,
    h.id,
    h.name,
    hm.role
  from public.households h
  join public.household_members hm
    on hm.household_id = h.id
   and hm.user_id = current_user_id
  where h.id = resolved_household_id;
end;
$$;

revoke all on function public.bootstrap_default_household() from public;
grant execute on function public.bootstrap_default_household() to authenticated;
