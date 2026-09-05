import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import ts from 'typescript';
import type { ServiceResult } from '../../services/result.ts';

const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(new URL('./sign-in-form.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});

function mount(result: ServiceResult<null>, hydrated = true) {
  const events: string[] = [];
  const messages: string[] = [];
  const refs = [{ current: { value: 'test@example.invalid' } }, { current: { value: 'runtime-only-test-password' } }];
  let transition: Promise<void> | undefined;
  const exports = {} as { SignInForm(): { props: { method: string; action: string; onSubmit(event: unknown): void } } };
  runInNewContext(outputText, {
    exports,
    console: { log() { assert.fail('No credential logging'); }, error() { assert.fail('No credential logging'); } },
    require(name: string) {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return {
        useRef: () => refs.shift(),
        useSyncExternalStore: () => hydrated,
        useState: () => ['', (message: string) => messages.push(message)],
        useTransition: () => [false, (action: () => Promise<void>) => { transition = action(); }],
      };
      if (name === 'next/navigation') return { useRouter: () => ({
        replace(path: string) { assert.equal(path, '/recipes'); events.push('redirect'); },
        refresh() { events.push('refresh'); },
      }) };
      if (name === '@/services/auth-browser') return { async signIn(email: string, password: string) {
        assert.deepEqual(events, ['preventDefault']);
        assert.equal(email, 'test@example.invalid');
        assert.equal(password, 'runtime-only-test-password');
        events.push('signIn');
        return result;
      } };
      throw new Error('Unexpected dependency');
    },
  });
  const form = exports.SignInForm();
  return {
    events, messages, form,
    async submit() {
      form.props.onSubmit({ preventDefault() { events.push('preventDefault'); }, currentTarget: { reset() { events.push('reset'); } } });
      await transition;
    },
  };
}

it('sign-in prevents native submission before calling the service and redirects only on success', async () => {
  const view = mount({ ok: true, data: null });
  assert.equal(view.form.props.method, 'post');
  assert.equal(view.form.props.action, '/sign-in');
  await view.submit();
  assert.deepEqual(view.events, ['preventDefault', 'signIn', 'reset', 'redirect', 'refresh']);
});

it('failed authentication preserves the service message and does not navigate', async () => {
  const message = 'We could not sign you in. Check your email and password and try again.';
  const view = mount({ ok: false, error: { code: 'unauthorized', message } });
  await view.submit();
  assert.deepEqual(view.events, ['preventDefault', 'signIn']);
  assert.deepEqual(view.messages, ['', message]);
});

it('an unhydrated form cannot attempt authentication or navigation', async () => {
  const view = mount({ ok: true, data: null }, false);
  await view.submit();
  assert.deepEqual(view.events, ['preventDefault']);
});
