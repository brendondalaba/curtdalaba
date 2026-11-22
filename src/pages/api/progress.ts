import type { APIRoute } from "astro";
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

  const { error } = await locals.supabase.from("playback_progress").upsert({
    user_id: user.id,
    sermon_id: sermonId,
    position_seconds: position,
    completed: completed === true,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    // Usually a sermon that was deleted mid-listen.
    return Response.json({ error: "Couldn't save progress" }, { status: 400 });
  }
  return new Response(null, { status: 204 });
};
