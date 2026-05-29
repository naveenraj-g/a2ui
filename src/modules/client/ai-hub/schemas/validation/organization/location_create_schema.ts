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

export const locationCreateSchema = z
  .object({
    // Seeded from Better Auth session by route.ts
    user_id: z.preprocess(toOptionalStr, z.string().min(1, "User session not found")),
    org_id: z.preprocess(toOptionalStr, z.string().min(1, "Organisation session not found")),

    // From step 1 context.outputs → sessionContext
    organization_id: z.preprocess(
      toPositiveInt,
      z.number().int().positive("Organisation ID is missing — complete step 1 first"),
    ),

    name: z.preprocess(toOptionalStr, z.string().min(1, "Location name is required")),

    status: z.preprocess(toOptionalStr, z.string().optional()),
    mode: z.preprocess(toOptionalStr, z.string().optional()),
    description: z.preprocess(toOptionalStr, z.string().optional()),

    // TerminologySelect id="physical_type" valueType="CodeableConcept"
    physical_type_code: z.preprocess(toOptionalStr, z.string().optional()),
    physical_type_system: z.preprocess(toOptionalStr, z.string().optional()),
    physical_type_display: z.preprocess(toOptionalStr, z.string().optional()),
    physical_type_text: z.preprocess(toOptionalStr, z.string().optional()),

    // Address
    address_use: z.preprocess(toOptionalStr, z.string().optional()),
    address_type: z.preprocess(toOptionalStr, z.string().optional()),
    address_line: z.preprocess(toOptionalStr, z.string().optional()),
    address_city: z.preprocess(toOptionalStr, z.string().optional()),
    address_state: z.preprocess(toOptionalStr, z.string().optional()),
    address_postal_code: z.preprocess(toOptionalStr, z.string().optional()),
    address_country: z.preprocess(toOptionalStr, z.string().optional()),

    availability_exceptions: z.preprocess(toOptionalStr, z.string().optional()),
  })
  .transform((d) => ({
    user_id: d.user_id,
    org_id: d.org_id,

    name: d.name,
    status: d.status || undefined,
    mode: d.mode || undefined,
    description: d.description || undefined,

    physical_type_code: d.physical_type_code || undefined,
    physical_type_system: d.physical_type_system || undefined,
    physical_type_display: d.physical_type_display || undefined,
    physical_type_text: d.physical_type_text || undefined,

    // Link to the organisation created in step 1
    managing_organization: `Organization/${d.organization_id}`,
    managing_organization_display: undefined,

    address_use: d.address_use || undefined,
    address_type: d.address_type || undefined,
    address_line: d.address_line ? [d.address_line] : undefined,
    address_city: d.address_city || undefined,
    address_state: d.address_state || undefined,
    address_postal_code: d.address_postal_code || undefined,
    address_country: d.address_country || undefined,

    availability_exceptions: d.availability_exceptions || undefined,
  }));
