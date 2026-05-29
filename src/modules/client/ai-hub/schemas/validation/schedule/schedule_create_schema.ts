import { z } from "zod";

const toOptionalStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s === "" || s === "undefined" || s === "null" ? undefined : s;
};

const toOptionalInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return undefined;
  const n = Number(s);
  return isNaN(n) ? undefined : Math.floor(n);
};

export const scheduleCreateSchema = z
  .object({
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    active:  z.boolean().optional(),
    comment: z.preprocess(toOptionalStr, z.string().optional()),
    planning_horizon_start: z.preprocess(toOptionalStr, z.string().optional()),
    planning_horizon_end:   z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: actor (PractitionerRole)
    actor_role_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    actor_display:  z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="specialty"
    specialty_code:    z.preprocess(toOptionalStr, z.string().optional()),
    specialty_system:  z.preprocess(toOptionalStr, z.string().optional()),
    specialty_display: z.preprocess(toOptionalStr, z.string().optional()),
    specialty_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="service_type"
    service_type_code:    z.preprocess(toOptionalStr, z.string().optional()),
    service_type_system:  z.preprocess(toOptionalStr, z.string().optional()),
    service_type_display: z.preprocess(toOptionalStr, z.string().optional()),
    service_type_text:    z.preprocess(toOptionalStr, z.string().optional()),
  })
  .transform((d) => ({
    user_id: d.user_id,
    org_id:  d.org_id,
    active:  d.active ?? true,
    comment: d.comment || undefined,
    planning_horizon_start: d.planning_horizon_start || undefined,
    planning_horizon_end:   d.planning_horizon_end   || undefined,

    actor: d.actor_role_id
      ? [{ reference: `PractitionerRole/${d.actor_role_id}`, reference_display: d.actor_display || undefined }]
      : undefined,

    specialty: d.specialty_code
      ? [{ coding_system: d.specialty_system, coding_code: d.specialty_code, coding_display: d.specialty_display, text: d.specialty_text }]
      : undefined,

    service_type: d.service_type_code
      ? [{ coding_system: d.service_type_system, coding_code: d.service_type_code, coding_display: d.service_type_display, text: d.service_type_text }]
      : undefined,
  }));
