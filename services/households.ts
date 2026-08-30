import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { err, ok, type ServiceResult } from "@/services/result";

export type HouseholdContext = {
  userId: string;
  profileId: string;
  householdId: string;
  householdName: string;
  role: "owner";
};

export async function ensureDefaultHousehold(): Promise<
  ServiceResult<HouseholdContext>
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return err("unauthorized", "Sign in is required to access a household.");
  }

  const { data, error: bootstrapError } = await supabase.rpc(
    "bootstrap_default_household",
  );

  if (bootstrapError) {
    return err(
      "unexpected_error",
      "Could not prepare the default household for this user.",
    );
  }

  const household = data.at(0);

  if (!household) {
    return err(
      "not_found",
      "No default household was returned for this user.",
    );
  }

  return ok({
    userId: household.user_id,
    profileId: household.profile_id,
    householdId: household.household_id,
    householdName: household.household_name,
    role: household.role,
  });
}

export async function getCurrentHousehold(): Promise<
  ServiceResult<HouseholdContext>
> {
  return ensureDefaultHousehold();
}
