import type { APIRoute } from "astro";

/** POST only, so a link or prefetch can't sign someone out. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  await locals.supabase.auth.signOut();
  return redirect("/login", 303);
};
