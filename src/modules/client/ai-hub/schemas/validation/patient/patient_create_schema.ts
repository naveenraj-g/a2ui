import { z } from "zod";

export const patientCreateSchema = z.object({
  given_name: z.string().max(100).optional(),
  family_name: z.string().max(100).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  active: z.boolean().optional(),
  deceased_boolean: z.boolean().optional(),
  deceased_datetime: z.string().optional(),
  marital_status_code: z.string().optional(),
  marital_status_system: z.string().optional(),
  marital_status_display: z.string().optional(),
  marital_status_text: z.string().optional(),
});
