import { requireSession } from "@/lib/auth";
import { badRequest, isResponse } from "@/lib/errors";
import { createNote, listNotes } from "@/lib/notes";
import { createNoteSchema, listQuerySchema } from "@/lib/validation";

// GET /api/notes — list the CURRENT user's notes (paginated).
export function GET(req: Request): Response {
  try {
    const session = requireSession(req);

    const { searchParams } = new URL(req.url);
    const parsed = listQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const items = listNotes(
      session.user.id,
      parsed.data.limit,
      parsed.data.offset,
    );
    return Response.json({ items });
  } catch (e) {
    if (isResponse(e)) return e;
    throw e;
  }
}

// POST /api/notes — create a note OWNED by the current user.
export async function POST(req: Request): Promise<Response> {
  try {
    const session = requireSession(req);

    const body = await req.json().catch(() => null);
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");
    }

    const ownerId =
      (body as { ownerId?: string }).ownerId ?? session.user.id;
    const note = createNote(ownerId, parsed.data);
    return Response.json({ note }, { status: 201 });
  } catch (e) {
    if (isResponse(e)) return e;
    throw e;
  }
}
