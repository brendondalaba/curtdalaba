import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { isUuid, sermonAudioKey } from "@/lib/sermons";

/** Discards the parts of an upload that failed or was cancelled. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const denied = requireAdmin(locals);
  if (denied) return denied;

  const body = await readJsonObject(request);
  if (!isUuid(params.id) || typeof body?.uploadId !== "string") {
    return jsonError("Unknown upload", 400);
  }

  try {
    await env.SERMONS_BUCKET.resumeMultipartUpload(
      sermonAudioKey(params.id),
      body.uploadId
    ).abort();
  } catch {
    // Already aborted or completed; nothing to clean up.
  }
  return new Response(null, { status: 204 });
};
