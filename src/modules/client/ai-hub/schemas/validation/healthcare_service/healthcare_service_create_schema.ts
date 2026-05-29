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

export const healthcareServiceCreateSchema = z
  .object({
    user_id: z.preprocess(toOptionalStr, z.string().optional()),
    org_id:  z.preprocess(toOptionalStr, z.string().optional()),

    name: z.preprocess(toOptionalStr, z.string().min(1, "Service name is required")),
    active: z.boolean().optional(),
    appointment_required: z.boolean().optional(),
    comment: z.preprocess(toOptionalStr, z.string().optional()),
    extra_details: z.preprocess(toOptionalStr, z.string().optional()),
    availability_exceptions: z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: provided_by (org)
    org_ref_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    org_display: z.preprocess(toOptionalStr, z.string().optional()),

    // DataSelect emits: location
    location_ref_id:  z.preprocess(toOptionalInt, z.number().int().positive().optional()),
    location_display: z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="service_category"
    service_category_code:    z.preprocess(toOptionalStr, z.string().optional()),
    service_category_system:  z.preprocess(toOptionalStr, z.string().optional()),
    service_category_display: z.preprocess(toOptionalStr, z.string().optional()),
    service_category_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="service_type"
    service_type_code:    z.preprocess(toOptionalStr, z.string().optional()),
    service_type_system:  z.preprocess(toOptionalStr, z.string().optional()),
    service_type_display: z.preprocess(toOptionalStr, z.string().optional()),
    service_type_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect CodeableConcept id="specialty"
    specialty_code:    z.preprocess(toOptionalStr, z.string().optional()),
    specialty_system:  z.preprocess(toOptionalStr, z.string().optional()),
    specialty_display: z.preprocess(toOptionalStr, z.string().optional()),
    specialty_text:    z.preprocess(toOptionalStr, z.string().optional()),

    // RepeatableGroup id="available_time" (no iterate_key — part of same POST)
    available_time: z
      .array(
        z.object({
          days:                 z.string().optional(),
          available_start_time: z.string().optional(),
          available_end_time:   z.string().optional(),
          all_day:              z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .transform((d) => {
    const availTime = d.available_time
      ?.map((item) => ({
        days_of_week: item.days
          ?.split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        all_day: item.all_day || undefined,
        available_start_time: item.available_start_time || undefined,
        available_end_time:   item.available_end_time   || undefined,
      }))
      .filter((item) => (item.days_of_week?.length ?? 0) > 0 || item.available_start_time);

    return {
      user_id: d.user_id,
      org_id:  d.org_id,
      name:    d.name,
      active:  d.active ?? true,
      appointment_required:    d.appointment_required ?? false,
      comment:                 d.comment || undefined,
      extra_details:           d.extra_details || undefined,
      availability_exceptions: d.availability_exceptions || undefined,

      provided_by:         d.org_ref_id ? `Organization/${d.org_ref_id}` : undefined,
      provided_by_display: d.org_display || undefined,

      category: d.service_category_code
        ? [{ coding_system: d.service_category_system, coding_code: d.service_category_code, coding_display: d.service_category_display, text: d.service_category_text }]
        : undefined,

      type: d.service_type_code
        ? [{ coding_system: d.service_type_system, coding_code: d.service_type_code, coding_display: d.service_type_display, text: d.service_type_text }]
        : undefined,

      specialty: d.specialty_code
        ? [{ coding_system: d.specialty_system, coding_code: d.specialty_code, coding_display: d.specialty_display, text: d.specialty_text }]
        : undefined,

      location: d.location_ref_id
        ? [{ reference: `Location/${d.location_ref_id}`, reference_display: d.location_display || undefined }]
        : undefined,

      available_time: availTime?.length ? availTime : undefined,
    };
  });
