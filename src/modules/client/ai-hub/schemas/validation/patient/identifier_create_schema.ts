import { z } from "zod";

export const identifierCreateSchema = z.object({
  system: z.string().optional(),
  value: z.string().min(1, "Identifier value is required"),
});
