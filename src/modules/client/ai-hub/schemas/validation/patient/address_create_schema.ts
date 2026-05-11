import { z } from "zod";

export const addressCreateSchema = z.object({
  line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});
