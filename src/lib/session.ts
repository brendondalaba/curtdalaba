import { env } from "cloudflare:workers";
import type { AstroCookies } from "astro";

/**
 * Sign-in sessions. The browser holds a random token in an HttpOnly cookie;
 * the database stores only its SHA-256, so reading the table doesn't let
 * anyone sign in. The same scheme backs the one-time password reset links.
 */
export const SESSION_COOKIE = "session";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Members stay signed in on their phone; each visit in the second half renews it. */
const SESSION_DAYS = 60;
const RESET_LINK_DAYS = 3;

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function tokenId(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function setSessionCookie(
  cookies: AstroCookies,
  url: URL,
  token: string,
  expiresAt: number
) {
  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    expires: new Date(expiresAt),
  });
}

/** Signs a member in on this browser. */
export async function startSession(
  cookies: AstroCookies,
  url: URL,
  userId: string
) {
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
  await env.DB.prepare(
    "insert into sessions (id, user_id, expires_at) values (?, ?, ?)"
  )
    .bind(await tokenId(token), userId, expiresAt)
    .run();
  setSessionCookie(cookies, url, token, expiresAt);
}

/** The member this browser is signed in as, or null. Renews sessions past their halfway point. */
export async function readSession(
  cookies: AstroCookies,
  url: URL
): Promise<SessionUser | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = await tokenId(token);
  const row = await env.DB.prepare(
    `select u.id, u.email, u.full_name, u.is_admin, s.expires_at
       from sessions s join users u on u.id = s.user_id
      where s.id = ? and s.expires_at > ?`
  )
    .bind(id, Date.now())
    .first<{
      id: string;
      email: string;
      full_name: string | null;
      is_admin: number;
      expires_at: number;
    }>();
  if (!row) {
    cookies.delete(SESSION_COOKIE, { path: "/" });
    return null;
  }

  if (row.expires_at - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
    const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
    await env.DB.prepare("update sessions set expires_at = ? where id = ?")
      .bind(expiresAt, id)
      .run();
    setSessionCookie(cookies, url, token, expiresAt);
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isAdmin: row.is_admin === 1,
  };
}

/** Signs this browser out. */
export async function endSession(cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await env.DB.prepare("delete from sessions where id = ?")
      .bind(await tokenId(token))
      .run();
  }
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

/** Signs a member out everywhere except, optionally, this browser. */
export async function endOtherSessions(userId: string, cookies?: AstroCookies) {
  const token = cookies?.get(SESSION_COOKIE)?.value;
  const keep = token ? await tokenId(token) : "";
  await env.DB.prepare("delete from sessions where user_id = ? and id <> ?")
    .bind(userId, keep)
    .run();
}

/** Makes a one-time password reset link for a member; returns the token. */
export async function createPasswordReset(userId: string) {
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("delete from password_resets where user_id = ?").bind(
      userId
    ),
    env.DB.prepare(
      "insert into password_resets (id, user_id, expires_at) values (?, ?, ?)"
    ).bind(await tokenId(token), userId, Date.now() + RESET_LINK_DAYS * DAY_MS),
  ]);
  return token;
}

/** The member a reset link belongs to, if it's still valid. */
export async function findPasswordReset(token: string) {
  if (!token) return null;
  return env.DB.prepare(
    `select u.id, u.email from password_resets r join users u on u.id = r.user_id
      where r.id = ? and r.expires_at > ?`
  )
    .bind(await tokenId(token), Date.now())
    .first<{ id: string; email: string }>();
}

/** Clears expired sessions and reset links. Run now and then (after sign-in). */
export async function deleteExpired() {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("delete from sessions where expires_at <= ?").bind(now),
    env.DB.prepare("delete from password_resets where expires_at <= ?").bind(
      now
    ),
  ]);
}
