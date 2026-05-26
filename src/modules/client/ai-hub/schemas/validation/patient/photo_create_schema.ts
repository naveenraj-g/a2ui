import { z } from "zod";

export const photoCreateSchema = z.object({
  url: z.string().url("Must be a valid URL").optional(),
  content_type: z.string().optional(),
  title: z.string().optional(),
});
