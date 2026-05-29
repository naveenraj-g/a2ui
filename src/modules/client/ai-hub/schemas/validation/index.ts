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
import { organizationCreateSchema } from "./organization/organization_create_schema";
import { locationCreateSchema } from "./organization/location_create_schema";
import { healthcareServiceCreateSchema } from "./healthcare_service/healthcare_service_create_schema";
import { practitionerCreateSchema } from "./practitioner/practitioner_create_schema";
import { practitionerNameCreateSchema } from "./practitioner/practitioner_name_create_schema";
import { practitionerIdentifierCreateSchema } from "./practitioner/practitioner_identifier_create_schema";
import { practitionerTelecomCreateSchema } from "./practitioner/practitioner_telecom_create_schema";
import { practitionerQualificationCreateSchema } from "./practitioner/practitioner_qualification_create_schema";
import { practitionerCommunicationCreateSchema } from "./practitioner/practitioner_communication_create_schema";
import { practitionerRoleCreateSchema } from "./practitioner/practitioner_role_create_schema";
import { scheduleCreateSchema } from "./schedule/schedule_create_schema";
import { slotCreateSchema } from "./schedule/slot_create_schema";

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
  organization_create_schema: organizationCreateSchema,
  location_create_schema: locationCreateSchema,
  healthcare_service_create_schema: healthcareServiceCreateSchema,
  practitioner_create_schema: practitionerCreateSchema,
  practitioner_name_create_schema: practitionerNameCreateSchema,
  practitioner_identifier_create_schema: practitionerIdentifierCreateSchema,
  practitioner_telecom_create_schema: practitionerTelecomCreateSchema,
  practitioner_qualification_create_schema: practitionerQualificationCreateSchema,
  practitioner_communication_create_schema: practitionerCommunicationCreateSchema,
  practitioner_role_create_schema: practitionerRoleCreateSchema,
  schedule_create_schema: scheduleCreateSchema,
  slot_create_schema: slotCreateSchema,
};
