import { describe, expect, it } from "vitest";
import {
  createNoteSchema,
  listQuerySchema,
  updateNoteSchema,
} from "@/lib/validation";

describe("createNoteSchema", () => {
  it("accepts valid input", () => {
    expect(createNoteSchema.safeParse({ title: "T", body: "B" }).success).toBe(
      true,
    );
  });

  it("rejects empty title", () => {
    expect(createNoteSchema.safeParse({ title: "", body: "B" }).success).toBe(
      false,
    );
  });

  it("rejects an over-long title", () => {
    const long = "x".repeat(121);
    expect(
      createNoteSchema.safeParse({ title: long, body: "B" }).success,
    ).toBe(false);
  });
});

describe("updateNoteSchema", () => {
  it("requires at least one field", () => {
    expect(updateNoteSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a single field", () => {
    expect(updateNoteSchema.safeParse({ title: "T" }).success).toBe(true);
  });
});

describe("listQuerySchema", () => {
  it("applies defaults", () => {
    const parsed = listQuerySchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it("coerces string query params", () => {
    const parsed = listQuerySchema.parse({ limit: "5", offset: "10" });
    expect(parsed.limit).toBe(5);
    expect(parsed.offset).toBe(10);
  });

  it("accepts high limit query values", () => {
    expect(listQuerySchema.safeParse({ limit: "500" }).success).toBe(true);
  });
});
