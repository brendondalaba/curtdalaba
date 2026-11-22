import { defineMiddleware } from "astro:middleware";
import { readSession } from "@/lib/session";

/** Pages a signed-out visitor may open. Everything else requires a member. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  const user = await readSession(context.cookies, context.url);
  context.locals.user = user;
  context.locals.isAdmin = user?.isAdmin ?? false;

  if (!user && !PUBLIC_PATHS.has(path)) {
    if (path.startsWith("/api/")) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const target =
      path === "/" ? "" : `?next=${encodeURIComponent(path + search)}`;
    return context.redirect(`/login${target}`);
  }

  if (user && (path === "/login" || path === "/signup")) {
    return context.redirect("/");
  }

  const response = await next();

  // Pages show one member's data; never let a CDN or the browser reuse them.
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
});
