// Row types for the D1 tables in migrations/. SQLite has no boolean type, so
// flags are stored as 0/1 integers. Update these when the schema changes.

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string;
  is_admin: 0 | 1;
  created_at: string;
};

export type Member = Omit<UserRow, "password_hash">;

export type SermonRow = {
  id: string;
  title: string;
  scripture: string | null;
  /** Date shown in the list. Set to the upload date (column name kept from v1). */
  preached_on: string;
  audio_content_type: string;
  audio_size_bytes: number | null;
  duration_seconds: number | null;
  created_at: string;
  created_by: string | null;
};

export type SermonListItem = Pick<
  SermonRow,
  "id" | "title" | "scripture" | "preached_on" | "duration_seconds"
>;

export type ProgressRow = {
  sermon_id: string;
  position_seconds: number;
  completed: 0 | 1;
};

/** Current time in the same ISO format the tables use for their defaults. */
export function nowIso() {
  return new Date().toISOString();
}

/** True when a D1 error is a UNIQUE constraint failure (for example, a taken email). */
export function isUniqueViolation(error: unknown) {
  return (
    error instanceof Error && /UNIQUE constraint failed/i.test(error.message)
  );
}
