export const MAX_UPLOAD_MB = 500;
/** R2 multipart parts must be at least 5 MB (except the last). */
export const UPLOAD_PART_BYTES = 10 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function sermonAudioKey(sermonId: string) {
  return `sermons/${sermonId}`;
}

export function isAudioContentType(value: unknown): value is string {
  return typeof value === "string" && /^audio\/[\w.+-]+$/.test(value);
}

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * The date a sermon is listed under: the day it was uploaded. Uses the
 * uploader's local date when it's within a day of now (time zones), so an
 * evening upload in the US isn't listed as tomorrow; otherwise today in UTC.
 */
export function uploadDate(browserDate: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  if (!isIsoDate(browserDate)) return today;
  const offByMs = Math.abs(Date.parse(browserDate) - Date.parse(today));
  return offByMs <= 24 * 60 * 60 * 1000 ? browserDate : today;
}
