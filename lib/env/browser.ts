import "client-only";

type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function requirePublicEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required public environment variable: ${name}`);
  }

  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: requirePublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
