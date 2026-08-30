import "server-only";

type ServerEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
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
    supabasePublishableKey: requireServerEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}
