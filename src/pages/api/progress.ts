import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { nowIso } from "@/lib/db";
import { isUuid } from "@/lib/sermons";

/** Saves where the member stopped. Sent by the player (also via sendBeacon). */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { sermonId, position, completed } = body as Record<string, unknown>;
  if (
    !isUuid(sermonId) ||
    typeof position !== "number" ||
    !Number.isFinite(position) ||
    position < 0
  ) {
    return Response.json({ error: "Invalid progress" }, { status: 400 });
  }

  try {
    await env.DB.prepare(
      `insert into playback_progress (user_id, sermon_id, position_seconds, completed, updated_at)
       values (?, ?, ?, ?, ?)
       on conflict (user_id, sermon_id) do update set
         position_seconds = excluded.position_seconds,
         completed = excluded.completed,
         updated_at = excluded.updated_at`
    )
      .bind(user.id, sermonId, position, completed === true ? 1 : 0, nowIso())
      .run();
  } catch {
    // Usually a sermon that was deleted mid-listen.
    return Response.json({ error: "Couldn't save progress" }, { status: 400 });
  }
  return new Response(null, { status: 204 });
};
