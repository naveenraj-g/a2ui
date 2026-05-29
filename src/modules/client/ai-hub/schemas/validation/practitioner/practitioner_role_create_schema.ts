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

const toOptionalInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  if (s === "" || s === "undefined" || s === "null") return undefined;
  const n = Number(s);
  return isNaN(n) ? undefined : Math.floor(n);
};

export const practitionerRoleCreateSchema = z
  .object({
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    // Seeded from sessionContext after step 1
    practitioner_id: z.preprocess(
      toPositiveInt,
      z.number().int().positive("Practitioner ID missing — complete step 1 first"),
    ),

    active:       z.boolean().optional(),
    period_start: z.preprocess(toOptionalStr, z.string().optional()),
    period_end:   z.preprocess(toOptionalStr, z.string().optional()),
    availability_exceptions: z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: role_org
    role_org_ref_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    role_org_display: z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: role_location
    role_location_ref_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    role_location_display: z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: role_service
    svc_ref_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    svc_display: z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="role_code"
    role_code_code:    z.preprocess(toOptionalStr, z.string().optional()),
    role_code_system:  z.preprocess(toOptionalStr, z.string().optional()),
    role_code_display: z.preprocess(toOptionalStr, z.string().optional()),
    role_code_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="role_specialty"
    role_specialty_code:    z.preprocess(toOptionalStr, z.string().optional()),
    role_specialty_system:  z.preprocess(toOptionalStr, z.string().optional()),
    role_specialty_display: z.preprocess(toOptionalStr, z.string().optional()),
    role_specialty_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // Flat availability fields
    avail_days:  z.preprocess(toOptionalStr, z.string().optional()),
    avail_start: z.preprocess(toOptionalStr, z.string().optional()),
    avail_end:   z.preprocess(toOptionalStr, z.string().optional()),
  })
  .transform((d) => ({
    user_id: d.user_id,
    org_id:  d.org_id,

    practitioner:         `Practitioner/${d.practitioner_id}`,
    organization:         d.role_org_ref_id ? `Organization/${d.role_org_ref_id}` : undefined,
    organization_display: d.role_org_display || undefined,

    active:       d.active ?? true,
    period_start: d.period_start || undefined,
    period_end:   d.period_end   || undefined,
    availability_exceptions: d.availability_exceptions || undefined,

    location: d.role_location_ref_id
      ? [{ reference: `Location/${d.role_location_ref_id}`, reference_display: d.role_location_display || undefined }]
      : undefined,

    healthcare_service: d.svc_ref_id
      ? [{ reference: `HealthcareService/${d.svc_ref_id}`, reference_display: d.svc_display || undefined }]
      : undefined,

    code: d.role_code_code
      ? [{ coding_system: d.role_code_system, coding_code: d.role_code_code, coding_display: d.role_code_display, text: d.role_code_text }]
      : undefined,

    specialty: d.role_specialty_code
      ? [{ coding_system: d.role_specialty_system, coding_code: d.role_specialty_code, coding_display: d.role_specialty_display, text: d.role_specialty_text }]
      : undefined,

    availability:
      d.avail_days || d.avail_start
        ? [
            {
              available_times: [
                {
                  days_of_week: d.avail_days
                    ?.split(",")
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean),
                  available_start_time: d.avail_start || undefined,
                  available_end_time:   d.avail_end   || undefined,
                },
              ],
            },
          ]
        : undefined,
  }));
