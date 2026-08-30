create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint households_name_not_blank check (length(btrim(name)) > 0)
);

create type public.household_member_role as enum ('owner');

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.profiles
  add constraint profiles_default_household_id_fkey
  foreign key (default_household_id)
  references public.households(id)
  on delete set null;

create index households_created_by_idx on public.households(created_by);
create index household_members_user_id_idx on public.household_members(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(check_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = check_household_id
      and hm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and (
    default_household_id is null
    or public.is_household_member(default_household_id)
  )
);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and (
    default_household_id is null
    or public.is_household_member(default_household_id)
  )
);

create policy "Users can view households they belong to"
on public.households
for select
to authenticated
using (public.is_household_member(id));

create policy "Users can view memberships for their households"
on public.household_members
for select
to authenticated
using (public.is_household_member(household_id));

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

  select default_household_id
  into resolved_household_id
  from public.profiles
  where id = current_user_id;

  if resolved_household_id is null then
    insert into public.households (name, created_by)
    values ('My Household', current_user_id)
    returning id into resolved_household_id;

    update public.profiles
    set default_household_id = resolved_household_id
    where id = current_user_id;
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
      returning id into resolved_household_id;

      update public.profiles
      set default_household_id = resolved_household_id
      where id = current_user_id;
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (resolved_household_id, current_user_id, 'owner')
  on conflict (household_id, user_id) do update
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
