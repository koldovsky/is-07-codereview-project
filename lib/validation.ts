import { z } from "zod";

/**
 * Zod schemas — the single source of truth for request input shape.
 * Every string has min/max; we never push raw JSON into the store.
 */

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  body: z.string().min(1, "Body is required").max(5000),
});

export const updateNoteSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    body: z.string().min(1).max(5000).optional(),
  })
  .refine((data) => data.title !== undefined || data.body !== undefined, {
    message: "Provide at least one field to update",
  });

export const listQuerySchema = z.object({
  // Query params arrive as strings — coerce, then clamp.
  limit: z.coerce.number().int().min(1).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
