import { z } from "zod";

const toOptionalStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s === "" || s === "undefined" || s === "null" ? undefined : s;
};

const toPositiveInt = (v: unknown) => {
  if (v === undefined || v === null) return -1;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return -1;
  const n = Number(s);
  return isNaN(n) ? -1 : Math.floor(n);
};

// Receives { ...sessionContext, ...slotItem } — schedule_id comes from sessionContext
// (submit/route.ts passes merged context for iterate_key schemas)
export const slotCreateSchema = z
  .object({
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    schedule_id: z.preprocess(
      toPositiveInt,
      z.number().int().positive("Schedule ID missing — complete step 1 first"),
    ),

    status: z.preprocess(toOptionalStr, z.string().min(1, "Slot status is required")),
    start:  z.preprocess(toOptionalStr, z.string().optional()),
    end:    z.preprocess(toOptionalStr, z.string().optional()),
    comment: z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="appointment_type"
    appointment_type_code:    z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_system:  z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_display: z.preprocess(toOptionalStr, z.string().optional()),
    appointment_type_text:    z.preprocess(toOptionalStr, z.string().optional()),
  })
  .transform((d) => ({
    user_id: d.user_id,
    org_id:  d.org_id,
    schedule: `Schedule/${d.schedule_id}`,
    status:   d.status,
    start:    d.start   || undefined,
    end:      d.end     || undefined,
    comment:  d.comment || undefined,
    appointment_type_code:    d.appointment_type_code    || undefined,
    appointment_type_system:  d.appointment_type_system  || undefined,
    appointment_type_display: d.appointment_type_display || undefined,
    appointment_type_text:    d.appointment_type_text    || undefined,
  }));
