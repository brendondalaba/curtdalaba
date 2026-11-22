import type { APIRoute } from "astro";
import { endSession } from "@/lib/session";

/** POST only, so a link or prefetch can't sign someone out. */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await endSession(cookies);
  return redirect("/login", 303);
};
