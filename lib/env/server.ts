import "server-only";

type ServerEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
};

function requireServerEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getServerEnv(): ServerEnv {
  return {
    supabaseUrl: requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: requireServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
