export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Admin-only API routes call this first; returns a response to send if not allowed. */
export function requireAdmin(locals: App.Locals) {
  if (!locals.user) return jsonError("Sign in required", 401);
  if (!locals.isAdmin) return jsonError("Admins only", 403);
  return null;
}

export async function readJsonObject(request: Request) {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
