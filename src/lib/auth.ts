import { env } from "cloudflare:workers";

export const MIN_PASSWORD_LENGTH = 8;

/** Only allow redirects back into this site, never to another origin. */
export function safeRedirectPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/\\")) return fallback;
  return value;
}

/** Returns false when this IP has made too many sign-in attempts recently. */
export async function isWithinAuthRateLimit(request: Request, scope: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.AUTH_LIMITER.limit({ key: `${scope}:${ip}` });
  return success;
}

/** Case- and space-insensitive so "abcd 1234" matches "ABCD1234". */
export function normalizeAccessCode(code: string) {
  return code.replace(/\s+/g, "").toUpperCase();
}

/** Compares in constant time so response timing doesn't leak the code. */
export async function accessCodesMatch(given: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [given, expected].map(value =>
      crypto.subtle.digest(
        "SHA-256",
        encoder.encode(normalizeAccessCode(value))
      )
    )
  );
  // Digests are always 32 bytes, so this loop's timing doesn't depend on the input.
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

export function formString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Passwords keep their spaces; everything else is trimmed. */
export function formPassword(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
