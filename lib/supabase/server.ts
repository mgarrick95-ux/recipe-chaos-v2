import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but cannot write response cookies.
        }
      },
    },
  });
}
