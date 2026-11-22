import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import { isUuid, sermonAudioKey, uploadDate } from "@/lib/sermons";

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
  const preachedOn = uploadDate(body?.uploadedOn);
  const duration = body?.durationSeconds;
  const uploadId = body?.uploadId;
  const parts = body?.parts;

  if (typeof uploadId !== "string" || !isPartList(parts)) {
    return jsonError("Unknown upload", 400);
  }
  if (!title || title.length > 200) return jsonError("Add a title", 400);
  if (scripture.length > 200) return jsonError("Scripture is too long", 400);

  const key = sermonAudioKey(params.id);
  const upload = env.SERMONS_BUCKET.resumeMultipartUpload(key, uploadId);
  let object: R2Object;
  try {
    object = await upload.complete(parts);
  } catch (error) {
    console.error("R2 complete failed", error);
    return jsonError("Upload couldn't be finished. Try again.", 502);
  }

  try {
    await env.DB.prepare(
      `insert into sermons (id, title, scripture, preached_on, audio_content_type,
         audio_size_bytes, duration_seconds, created_by)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        params.id,
        title,
        scripture || null,
        preachedOn,
        object.httpMetadata?.contentType ?? "audio/mpeg",
        object.size,
        typeof duration === "number" &&
          Number.isFinite(duration) &&
          duration >= 0
          ? Math.round(duration)
          : null,
        locals.user?.id ?? null
      )
      .run();
  } catch (error) {
    console.error("Insert sermon failed", error);
    await env.SERMONS_BUCKET.delete(key);
    return jsonError("Couldn't save the sermon. Try again.", 500);
  }

  return Response.json({ id: params.id });
};
