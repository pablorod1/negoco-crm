import { z } from "zod";

export const MoveRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("files"),
    file_ids: z.array(z.string().min(1)).min(1),
    destination_folder: z.string().min(1),
  }),
  z
    .object({
      kind: z.literal("folder"),
      folder_path: z.string().min(1),
      destination_parent: z.string().optional(),
      new_name: z.string().optional(),
    })
    .refine(
      (body) => body.destination_parent !== undefined || body.new_name !== undefined,
      { message: "destination_parent or new_name is required" }
    ),
]);

export const MovePlanBodySchema = z.object({
  organization_id: z.string().min(1),
  request: MoveRequestSchema,
});

export const MoveCommitBodySchema = MovePlanBodySchema.extend({
  updates: z.array(
    z.object({ id: z.string().min(1), download_url: z.string().url() })
  ),
});
