import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, readJsonObject, requireAdmin } from "@/lib/api";
import {
  isAudioContentType,
  MAX_UPLOAD_MB,
  sermonAudioKey,
} from "@/lib/sermons";

/**
 * Starts a multipart upload to R2. Files go up in 10 MB parts (see
 * [id]/part.ts) because a single Worker request body is capped at 100 MB.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireAdmin(locals);
  if (denied) return denied;

  const body = await readJsonObject(request);
  const contentType = body?.contentType;
  const size = body?.size;
  if (!isAudioContentType(contentType)) {
    return jsonError("Choose an audio file (MP3, M4A, …)", 400);
  }
  if (typeof size !== "number" || size <= 0) {
    return jsonError("The file is empty", 400);
  }
  if (size > MAX_UPLOAD_MB * 1024 * 1024) {
    return jsonError(`Files must be under ${MAX_UPLOAD_MB} MB`, 400);
  }

  const id = crypto.randomUUID();
  const upload = await env.SERMONS_BUCKET.createMultipartUpload(
    sermonAudioKey(id),
    { httpMetadata: { contentType } }
  );
  return Response.json({ id, uploadId: upload.uploadId });
};
