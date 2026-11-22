import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "@/lib/supabase";

/** Pages a signed-out visitor may open. Everything else requires a member. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
]);

/** Hit on every audio range request and progress save; skip the admin lookup. */
const NO_PROFILE_PATHS = ["/api/audio/", "/api/progress"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  const cacheHeaders: Record<string, string> = {};
  const supabase = createSupabaseServerClient(
    context.request,
    context.cookies,
    cacheHeaders
  );
  context.locals.supabase = supabase;
  context.locals.isAdmin = false;

  // getClaims verifies the JWT signature (refreshing an expired session),
  // unlike getSession, which trusts whatever is in the cookie.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  context.locals.user = claims
    ? { id: claims.sub, email: claims.email ?? "" }
    : null;

  if (!context.locals.user && !PUBLIC_PATHS.has(path)) {
    if (path.startsWith("/api/")) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const target =
      path === "/" ? "" : `?next=${encodeURIComponent(path + search)}`;
    return context.redirect(`/login${target}`);
  }

  if (context.locals.user && (path === "/login" || path === "/signup")) {
    return context.redirect("/");
  }

  if (
    context.locals.user &&
    !NO_PROFILE_PATHS.some(prefix => path.startsWith(prefix))
  ) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    context.locals.isAdmin = isAdmin === true;
  }

  const response = await next();

  for (const [key, value] of Object.entries(cacheHeaders)) {
    response.headers.set(key, value);
  }
  // Pages show one member's data; never let a CDN or the browser reuse them.
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
});
