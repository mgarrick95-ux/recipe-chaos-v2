import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env/browser";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
