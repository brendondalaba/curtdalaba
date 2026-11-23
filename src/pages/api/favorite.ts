import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, readJsonObject } from "@/lib/api";
import { nowIso } from "@/lib/db";
import { isUuid } from "@/lib/sermons";

/** Stars or unstars a sermon for the signed-in member. */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return jsonError("Sign in required", 401);

  const body = await readJsonObject(request);
  const sermonId = body?.sermonId;
  const favorite = body?.favorite;
  if (!isUuid(sermonId) || typeof favorite !== "boolean") {
    return jsonError("Invalid favorite", 400);
  }

  try {
    // Leaves listening progress alone; only the flag changes.
    await env.DB.prepare(
      `insert into playback_progress (user_id, sermon_id, favorite, updated_at)
       values (?, ?, ?, ?)
       on conflict (user_id, sermon_id) do update set favorite = excluded.favorite`
    )
      .bind(user.id, sermonId, favorite ? 1 : 0, nowIso())
      .run();
  } catch {
    return jsonError("Couldn't save favorite", 400);
  }
  return new Response(null, { status: 204 });
};
