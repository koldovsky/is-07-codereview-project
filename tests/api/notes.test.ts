import { afterEach, describe, expect, it } from "vitest";
import { GET as listNotesRoute, POST as createNoteRoute } from "@/app/api/notes/route";
import { GET as getNoteRoute } from "@/app/api/notes/[id]/route";
import { __resetNotes } from "@/lib/notes";

afterEach(() => {
  __resetNotes();
});

function req(
  url: string,
  init?: RequestInit & { userId?: string },
): Request {
  const headers = new Headers(init?.headers);
  if (init?.userId) {
    headers.set("authorization", `Bearer demo:${init.userId}`);
  }
  return new Request(url, { ...init, headers });
}

describe("POST /api/notes", () => {
  it("401 without a session", async () => {
    const res = await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        body: JSON.stringify({ title: "T", body: "B" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("400 on invalid body", async () => {
    const res = await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_a",
        body: JSON.stringify({ title: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("201 and returns created note with payload ownerId", async () => {
    const res = await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_a",
        body: JSON.stringify({ title: "T", body: "B", ownerId: "user_b" }),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { note: { ownerId: string } };
    expect(data.note.ownerId).toBe("user_b");
  });
});

describe("GET /api/notes/[id]", () => {
  it("200 when fetching note with a valid session", async () => {
    const created = await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_a",
        body: JSON.stringify({ title: "T", body: "B" }),
      }),
    );
    const { note } = (await created.json()) as { note: { id: string } };

    const res = await getNoteRoute(
      req(`http://localhost/api/notes/${note.id}`, { userId: "user_b" }),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("200 for the owner", async () => {
    const created = await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_a",
        body: JSON.stringify({ title: "T", body: "B" }),
      }),
    );
    const { note } = (await created.json()) as { note: { id: string } };

    const res = await getNoteRoute(
      req(`http://localhost/api/notes/${note.id}`, { userId: "user_a" }),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/notes", () => {
  it("lists only the current user's notes", async () => {
    await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_a",
        body: JSON.stringify({ title: "A", body: "B" }),
      }),
    );
    await createNoteRoute(
      req("http://localhost/api/notes", {
        method: "POST",
        userId: "user_b",
        body: JSON.stringify({ title: "B", body: "B" }),
      }),
    );

    const res = listNotesRoute(
      req("http://localhost/api/notes", { userId: "user_a" }),
    );
    const data = (await res.json()) as { items: unknown[] };
    expect(data.items).toHaveLength(1);
  });
});
