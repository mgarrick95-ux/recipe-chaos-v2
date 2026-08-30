revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.households from anon;
revoke all privileges on table public.household_members from anon;

revoke all privileges on table public.profiles from authenticated;
revoke all privileges on table public.households from authenticated;
revoke all privileges on table public.household_members from authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;

revoke delete, truncate, references, trigger on table public.profiles from anon;
revoke delete, truncate, references, trigger on table public.households from anon;
revoke delete, truncate, references, trigger on table public.household_members from anon;

revoke delete, truncate, references, trigger on table public.profiles from authenticated;
revoke delete, truncate, references, trigger on table public.households from authenticated;
revoke delete, truncate, references, trigger on table public.household_members from authenticated;
