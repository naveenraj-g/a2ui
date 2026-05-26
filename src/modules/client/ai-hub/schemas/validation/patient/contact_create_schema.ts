import { z } from "zod";

export const contactCreateSchema = z.object({
  name_family: z.string().optional(),
  name_given: z
    .string()
    .optional()
    .transform((v) => (v ? [v] : undefined)),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  address_line: z
    .string()
    .optional()
    .transform((v) => (v ? [v] : undefined)),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_postal_code: z.string().optional(),
  address_country: z.string().optional(),
});
