import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { isIsoDate, isUuid, sermonAudioKey } from "@/lib/sermons";

function isPartList(value: unknown): value is R2UploadedPart[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      part =>
        typeof part === "object" &&
        part !== null &&
        Number.isInteger(part.partNumber) &&
        typeof part.etag === "string"
    )
  );
}

/** Finishes the R2 upload and adds the sermon to the library. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const denied = requireAdmin(locals);
  if (denied) return denied;
  if (!isUuid(params.id)) return jsonError("Unknown upload", 400);

  const body = await readJsonObject(request);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const scripture =
    typeof body?.scripture === "string" ? body.scripture.trim() : "";
  const preachedOn = body?.preachedOn;
  const duration = body?.durationSeconds;
  const uploadId = body?.uploadId;
  const parts = body?.parts;

  if (typeof uploadId !== "string" || !isPartList(parts)) {
    return jsonError("Unknown upload", 400);
  }
  if (!title || title.length > 200) return jsonError("Add a title", 400);
  if (scripture.length > 200) return jsonError("Scripture is too long", 400);
  if (!isIsoDate(preachedOn)) return jsonError("Add the date preached", 400);

  const key = sermonAudioKey(params.id);
  const upload = env.SERMONS_BUCKET.resumeMultipartUpload(key, uploadId);
  let object: R2Object;
  try {
    object = await upload.complete(parts);
  } catch (error) {
    console.error("R2 complete failed", error);
    return jsonError("Upload couldn't be finished. Try again.", 502);
  }

  const { error } = await locals.supabase.from("sermons").insert({
    id: params.id,
    title,
    scripture: scripture || null,
    preached_on: preachedOn,
    audio_content_type: object.httpMetadata?.contentType ?? "audio/mpeg",
    audio_size_bytes: object.size,
    duration_seconds:
      typeof duration === "number" && Number.isFinite(duration)
        ? Math.round(duration)
        : null,
    created_by: locals.user?.id ?? null,
  });
  if (error) {
    console.error("Insert sermon failed", error);
    await env.SERMONS_BUCKET.delete(key);
    return jsonError("Couldn't save the sermon. Try again.", 500);
  }

  return Response.json({ id: params.id });
};
