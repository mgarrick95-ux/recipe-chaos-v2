import { isIP } from 'node:net';

export type ValidRecipeImportUrl =
  | { ok: true; url: string }
  | { ok: false; message: string };

const BAD_SUFFIXES = [
  '.localhost', '.local', '.internal', '.lan', '.home', '.test',
  '.invalid', '.example', '.onion', '.arpa', '.localdomain',
] as const;

/**
 * Accept any ordinary public HTTPS hostname, not a publisher allowlist.
 * This is only the *syntax* check; the server MUST validate DNS answers
 * and pin the approved public IPv4 address when making each request.
 */
export function validateRecipeImportUrl(input: string): ValidRecipeImportUrl {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) {
    return { ok: false, message: 'Paste a recipe webpage link (up to 2,048 characters).' };
  }
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/u, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.searchParams.toString().length > 1200) {
      return {
        ok: false,
        message: 'Please use a direct HTTPS recipe link without credentials or a custom port.',
      };
    }
    if (host !== url.hostname.toLowerCase() || host.length > 253 || isIP(host) !== 0 ||
      !host.includes('.') || BAD_SUFFIXES.some(suffix => host.endsWith(suffix)) ||
      host.split('.').some(label =>
        label.length < 1 || label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)) ||
      !/[a-z]/u.test(host.split('.').at(-1) ?? '')) {
      return { ok: false, message: 'Please use a public recipe website, not a local or private address.' };
    }
    url.hash = '';
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, message: 'That does not look like a valid recipe website URL.' };
  }
}

/**
 * Deny internal, special-purpose, benchmark, documentation, reserved,
 * multicast and broadcast address blocks. Fail closed on unfamiliar forms.
 * IPv6 is deliberately not used: HTTPS requests pin a checked IPv4 only.
 */
export function isPublicRecipeIPv4(value: string): boolean {
  if (isIP(value) !== 4) return false;
  const octets = value.split('.').map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 100 && b >= 64 && b <= 127 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 0 && c === 0 || b === 0 && c === 2 || b === 168) ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
      a === 203 && b === 0 && c === 113) return false;
  return true;
}
