import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

it('signup prevents native submission, validates matching passwords, and does not serialize credentials', () => {
  const text = source('./sign-up-form.tsx');
  assert.match(text, /event\.preventDefault\(\)/);
  assert.match(text, /password !== confirmPassword/);
  assert.match(text, /minLength=\{8\}/);
  assert.match(text, /autoComplete="new-password"/);
  assert.doesNotMatch(text, /<input[^>]*\bname=/);
});

it('forgot-password prevents native submission and keeps email out of native form serialization', () => {
  const text = source('./forgot-password-form.tsx');
  assert.match(text, /event\.preventDefault\(\)/);
  assert.match(text, /requestPasswordReset\(email\)/);
  assert.match(text, /If that email belongs to a Recipe Chaos account/);
  assert.doesNotMatch(text, /<input[^>]*\bname=/);
});

it('reset-password prevents native submission, requires matching passwords, and does not serialize passwords', () => {
  const text = source('./reset-password-form.tsx');
  assert.match(text, /event\.preventDefault\(\)/);
  assert.match(text, /password !== confirmPassword/);
  assert.match(text, /minLength=\{8\}/);
  assert.match(text, /updatePassword\(password\)/);
  assert.doesNotMatch(text, /<input[^>]*\bname=/);
});
