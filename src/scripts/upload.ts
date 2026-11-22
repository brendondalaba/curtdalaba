import { MAX_UPLOAD_MB, UPLOAD_PART_BYTES } from "@/lib/sermons";

type UploadInput = {
  file: File;
  title: string;
  scripture: string;
  preachedOn: string;
  onProgress: (fraction: number) => void;
};

type UploadedPart = { partNumber: number; etag: string };

const PART_RETRIES = 3;

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Upload failed (${response.status}).`);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

function postJson<T>(url: string, body: unknown) {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Reads the length from the file itself so admins don't have to. */
function readDuration(file: File) {
  return new Promise<number | null>(resolve => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () =>
      done(Number.isFinite(audio.duration) ? audio.duration : null)
    );
    audio.addEventListener("error", () => done(null));
    audio.src = url;
  });
}

async function uploadPart(
  id: string,
  uploadId: string,
  partNumber: number,
  blob: Blob
) {
  const url = `/api/admin/uploads/${id}/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await request<UploadedPart>(url, { method: "PUT", body: blob });
    } catch (error) {
      if (attempt >= PART_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

/** Some systems (notably Windows for .m4a) report no MIME type; fall back to the extension. */
const TYPES_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
};

function audioType(file: File) {
  if (file.type.startsWith("audio/")) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension] ?? "";
}

export async function uploadSermon(input: UploadInput) {
  const { file, onProgress } = input;
  const contentType = audioType(file);
  if (!contentType) {
    throw new Error("Choose an audio file (MP3, M4A, …).");
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`Files must be under ${MAX_UPLOAD_MB} MB.`);
  }

  const durationSeconds = await readDuration(file);
  const { id, uploadId } = await postJson<{ id: string; uploadId: string }>(
    "/api/admin/uploads",
    { contentType, size: file.size }
  );

  try {
    const parts: UploadedPart[] = [];
    const partCount = Math.ceil(file.size / UPLOAD_PART_BYTES);
    for (let index = 0; index < partCount; index++) {
      const start = index * UPLOAD_PART_BYTES;
      const blob = file.slice(start, start + UPLOAD_PART_BYTES);
      parts.push(await uploadPart(id, uploadId, index + 1, blob));
      onProgress((index + 1) / partCount);
    }

    await postJson(`/api/admin/uploads/${id}/complete`, {
      uploadId,
      parts,
      title: input.title,
      scripture: input.scripture,
      preachedOn: input.preachedOn,
      durationSeconds,
    });
    return id;
  } catch (error) {
    await postJson(`/api/admin/uploads/${id}/abort`, { uploadId }).catch(
      () => undefined
    );
    throw error;
  }
}
