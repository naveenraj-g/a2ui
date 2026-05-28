import { z } from "zod";
import { appointmentCreateSchema } from "./appointment/appointment_create_schema";
import { patientCreateSchema } from "./patient/patient_create_schema";
import { identifierCreateSchema } from "./patient/identifier_create_schema";
import { telecomCreateSchema } from "./patient/telecom_create_schema";
import { addressCreateSchema } from "./patient/address_create_schema";
import { nameCreateSchema } from "./patient/name_create_schema";
import { communicationCreateSchema } from "./patient/communication_create_schema";
import { contactCreateSchema } from "./patient/contact_create_schema";
import { gpCreateSchema } from "./patient/gp_create_schema";
import { photoCreateSchema } from "./patient/photo_create_schema";
import { linkCreateSchema } from "./patient/link_create_schema";

/** Maps the workflow action's validation_schema key to the corresponding Zod schema. */
export const VALIDATION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  appointment_create_schema: appointmentCreateSchema,
  patient_create_schema: patientCreateSchema,
  identifier_create_schema: identifierCreateSchema,
  telecom_create_schema: telecomCreateSchema,
  address_create_schema: addressCreateSchema,
  name_create_schema: nameCreateSchema,
  communication_create_schema: communicationCreateSchema,
  contact_create_schema: contactCreateSchema,
  gp_create_schema: gpCreateSchema,
  photo_create_schema: photoCreateSchema,
  link_create_schema: linkCreateSchema,
};
