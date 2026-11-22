import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { jsonError, requireAdmin } from "@/lib/api";
import { isUuid, sermonAudioKey, UPLOAD_PART_BYTES } from "@/lib/sermons";

/** Receives one part: PUT ?uploadId=…&partNumber=N with the raw bytes as the body. */
export const PUT: APIRoute = async ({ params, request, url, locals }) => {
  const denied = requireAdmin(locals);
  if (denied) return denied;

  const uploadId = url.searchParams.get("uploadId");
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!isUuid(params.id) || !uploadId) return jsonError("Unknown upload", 400);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
    return jsonError("Invalid part number", 400);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > UPLOAD_PART_BYTES) {
    return jsonError("Invalid part size", 400);
  }

  const upload = env.SERMONS_BUCKET.resumeMultipartUpload(
    sermonAudioKey(params.id),
    uploadId
  );
  try {
    const part = await upload.uploadPart(partNumber, bytes);
    return Response.json(part);
  } catch (error) {
    console.error("R2 uploadPart failed", error);
    return jsonError("Upload failed. Try again.", 502);
  }
};
