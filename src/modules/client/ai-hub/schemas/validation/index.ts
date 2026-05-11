import { z } from "zod";
import { patientCreateSchema } from "./patient/patient_create_schema";
import { identifierCreateSchema } from "./patient/identifier_create_schema";
import { telecomCreateSchema } from "./patient/telecom_create_schema";
import { addressCreateSchema } from "./patient/address_create_schema";

/** Maps the workflow action's validation_schema key to the corresponding Zod schema. */
export const VALIDATION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  patient_create_schema: patientCreateSchema,
  identifier_create_schema: identifierCreateSchema,
  telecom_create_schema: telecomCreateSchema,
  address_create_schema: addressCreateSchema,
};
