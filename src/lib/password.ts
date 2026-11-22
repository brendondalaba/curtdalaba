/**
 * Password hashing with PBKDF2-SHA256 from the Web Crypto API (no dependency).
 *
 * The Workers Free plan allows about 10 ms of CPU per request, and PBKDF2 is
 * deliberately slow, so the iteration count is a balance. The count is stored
 * in each hash: raise ITERATIONS (Workers caps it at 100,000) and members are
 * re-hashed at the new strength the next time they sign in.
 */
export const ITERATIONS = 30_000;
const PREFIX = "pbkdf2-sha256";
const SALT_BYTES = 16;
const HASH_BITS = 256;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

/** Constant-time comparison of two byte arrays of the same length. */
export function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * The hash of a random, discarded password. Checked when an email matches no
 * account, so unknown emails take as long as real ones.
 */
const DUMMY_HASH =
  "pbkdf2-sha256$30000$cNI95fZfxO20feA7wb5SNg==$AmZ6mpNgvUnwBR9hfQ0tXGl5BTmPtVRrpQiKVJ6v9eY=";

/**
 * Checks a password against a stored hash. Pass null when the email didn't
 * match anyone: the work is still done, so timing doesn't reveal who has an
 * account. `outdated` means the hash should be replaced at today's strength.
 */
export async function verifyPassword(password: string, stored: string | null) {
  const [prefix, iterationText, saltText, hashText] = (
    stored ?? DUMMY_HASH
  ).split("$");
  const iterations = Number(iterationText);
  if (
    prefix !== PREFIX ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    !saltText ||
    !hashText
  ) {
    return { valid: false, outdated: false };
  }
  const expected = fromBase64(hashText);
  const actual = await derive(password, fromBase64(saltText), iterations);
  return {
    valid: stored !== null && bytesEqual(actual, expected),
    outdated: iterations !== ITERATIONS,
  };
}
