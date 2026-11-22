import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isUuid, sermonAudioKey } from "@/lib/sermons";

/**
 * Streams a sermon from the private R2 bucket. The middleware has already
 * rejected anyone who isn't signed in; this is the only way audio leaves R2.
 * Supports Range requests so players can seek and iOS can play at all.
 */
export const GET: APIRoute = async ({ params, request }) => {
  if (!isUuid(params.id)) return new Response("Not found", { status: 404 });
  const key = sermonAudioKey(params.id);
  const hasRange = request.headers.has("Range");

  let object: R2ObjectBody | null;
  try {
    object = await env.SERMONS_BUCKET.get(key, {
      range: hasRange ? request.headers : undefined,
    });
  } catch {
    // R2 throws on a range it can't satisfy.
    const head = await env.SERMONS_BUCKET.head(key);
    if (!head) return new Response("Not found", { status: 404 });
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${head.size}` },
    });
  }
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", "inline");
  // Never stored by a shared cache; the URL alone must not grant access.
  headers.set("Cache-Control", "private, no-store");

  const range = object.range;
  if (hasRange && range) {
    const size = object.size;
    let start: number;
    let end: number;
    if ("suffix" in range) {
      start = Math.max(0, size - range.suffix);
      end = size - 1;
    } else {
      start = range.offset ?? 0;
      end =
        range.length === undefined
          ? size - 1
          : Math.min(size - 1, start + range.length - 1);
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
};
