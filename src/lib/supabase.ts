import { env } from "cloudflare:workers";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import type { Database } from "@/lib/database.types";

/**
 * A Supabase client that acts as the signed-in member, reading and refreshing
 * the session from cookies. Create one per request: @supabase/ssr only hands
 * out the no-cache headers on a client's first cookie write.
 */
export function createSupabaseServerClient(
  request: Request,
  cookies: AstroCookies,
  responseHeaders: Record<string, string>
) {
  return createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            cookies.set(name, value, options);
          }
          Object.assign(responseHeaders, headers);
        },
      },
    }
  );
}

/**
 * Bypasses row level security. Server-only, and only for what members can't
 * do themselves: reading the access code at sign-up and managing accounts.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type SupabaseServerClient = ReturnType<
  typeof createSupabaseServerClient
>;
