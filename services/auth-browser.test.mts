import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('./auth-browser.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

type AuthMocks = {
  signInWithPassword?: (input: unknown) => Promise<unknown>;
  signUp?: (input: unknown) => Promise<unknown>;
  resetPasswordForEmail?: (email: string, options: unknown) => Promise<unknown>;
  updateUser?: (input: unknown) => Promise<unknown>;
};

type AuthResult = {
  ok: boolean;
  data?: null | { needsEmailConfirmation?: boolean };
  error?: { code: string; message: string };
};

type AuthApi = {
  signUp(email: string, password: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
};

type SignUpPayload = {
  email: string;
  password: string;
  options: { emailRedirectTo: string };
};

type ResetOptions = { redirectTo: string };
type PasswordPayload = { password: string };

function load(mocks: AuthMocks): AuthApi {
  const exported = {} as AuthApi;
  const sandboxModule = { exports: exported };
  runInNewContext(outputText, {
    module: sandboxModule,
    exports: exported,
    window: { location: { origin: 'https://recipe-chaos.example' } },
    require(name: string) {
      if (name === '@/lib/supabase/browser') {
        return { createBrowserSupabaseClient: () => ({ auth: mocks }) };
      }
      if (name === '@/services/result') {
        return {
          ok(data: unknown) { return { ok: true, data }; },
          err(code: string, message: string) { return { ok: false, error: { code, message } }; },
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return sandboxModule.exports;
}

it('signup uses the safe auth callback and reports when email confirmation is required', async () => {
  let payload: SignUpPayload | undefined;
  const api = load({
    async signUp(input) {
      payload = input as SignUpPayload;
      return { data: { session: null }, error: null };
    },
  });

  const result = await api.signUp('megan@example.com', 'long-enough-password');
  assert.equal(payload?.email, 'megan@example.com');
  assert.equal(payload?.password, 'long-enough-password');
  assert.equal(payload?.options.emailRedirectTo, 'https://recipe-chaos.example/auth/callback?next=/recipes');
  assert.equal(result.ok, true);
  assert.equal(result.data?.needsEmailConfirmation, true);
});

it('signup reports an immediately usable session without requiring email confirmation', async () => {
  const api = load({
    async signUp() {
      return { data: { session: { access_token: 'test-only' } }, error: null };
    },
  });

  const result = await api.signUp('megan@example.com', 'long-enough-password');
  assert.equal(result.ok, true);
  assert.equal(result.data?.needsEmailConfirmation, false);
});

it('password reset returns through the auth callback to the reset page', async () => {
  let email: string | undefined;
  let options: ResetOptions | undefined;
  const api = load({
    async resetPasswordForEmail(nextEmail, nextOptions) {
      email = nextEmail;
      options = nextOptions as ResetOptions;
      return { error: null };
    },
  });

  const result = await api.requestPasswordReset('megan@example.com');
  assert.equal(email, 'megan@example.com');
  assert.equal(options?.redirectTo, 'https://recipe-chaos.example/auth/callback?next=/reset-password');
  assert.equal(result.ok, true);
  assert.equal(result.data, null);
});

it('password update sends only the requested new password to Supabase', async () => {
  let payload: PasswordPayload | undefined;
  const api = load({
    async updateUser(input) {
      payload = input as PasswordPayload;
      return { error: null };
    },
  });

  const result = await api.updatePassword('another-long-password');
  assert.equal(payload?.password, 'another-long-password');
  assert.equal(payload ? Object.keys(payload).length : 0, 1);
  assert.equal(result.ok, true);
  assert.equal(result.data, null);
});

it('auth service maps provider failures to safe user-facing errors', async () => {
  const api = load({
    async signUp() {
      return { data: { session: null }, error: { message: 'provider detail that must stay hidden' } };
    },
  });

  const result = await api.signUp('megan@example.com', 'long-enough-password');
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'validation_error');
  assert.equal(result.error?.message, 'We could not create that account. Check the details and try again.');
  assert.doesNotMatch(result.error?.message ?? '', /provider detail/);
});
