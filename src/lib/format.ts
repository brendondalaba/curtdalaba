/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 2520 → "42 min", 4500 → "1 hr 15 min". */
export function formatDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const LONG_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

/** "2026-11-15" → "11/15/2026". Dates are stored without a time zone. */
export function formatSermonDate(isoDate: string) {
  return DATE_FORMAT.format(toDate(isoDate));
}

/** "2026-11-15" → "November 15, 2026", for search and screen readers. */
export function formatLongSermonDate(isoDate: string) {
  return LONG_DATE_FORMAT.format(toDate(isoDate));
}
