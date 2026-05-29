import patientCreateForm from "./patient_create_form.json";
import patientNameForm from "./patient_name_form.json";
import patientIdentifierForm from "./patient_identifier_form.json";
import patientTelecomForm from "./patient_telecom_form.json";
import patientAddressForm from "./patient_address_form.json";
import patientCommunicationForm from "./patient_communication_form.json";
import patientContactForm from "./patient_contact_form.json";
import patientGpForm from "./patient_gp_form.json";
import patientPhotoForm from "./patient_photo_form.json";
import patientLinkForm from "./patient_link_form.json";
import vitalsDashboard from "./vitals_dashboard.json";
import vitalsTable from "./vitals_table.json";
import appointmentCreateForm from "./appointment_create_form.json";
import appointmentPickPractitionerForm from "./appointment_pick_practitioner_form.json";
import appointmentPickSlotForm from "./appointment_pick_slot_form.json";
import appointmentConfirmBookingForm from "./appointment_confirm_booking_form.json";
import orgCreateForm from "./org_create_form.json";
import orgLocationCreateForm from "./org_location_create_form.json";
import healthcareServiceCreateForm from "./healthcare_service_create_form.json";
import practitionerCreateForm from "./practitioner_create_form.json";
import practitionerNameForm from "./practitioner_name_form.json";
import practitionerIdentifierForm from "./practitioner_identifier_form.json";
import practitionerTelecomForm from "./practitioner_telecom_form.json";
import practitionerQualificationForm from "./practitioner_qualification_form.json";
import practitionerCommunicationForm from "./practitioner_communication_form.json";
import practitionerRoleCreateForm from "./practitioner_role_create_form.json";
import scheduleCreateForm from "./schedule_create_form.json";
import slotCreateForm from "./slot_create_form.json";

/** Maps the workflow step's ui.schema name to the component tree JSON. */
export const UI_SCHEMA_REGISTRY: Record<string, unknown> = {
  patient_create_form: patientCreateForm,
  patient_name_form: patientNameForm,
  patient_identifier_form: patientIdentifierForm,
  patient_telecom_form: patientTelecomForm,
  patient_address_form: patientAddressForm,
  patient_communication_form: patientCommunicationForm,
  patient_contact_form: patientContactForm,
  patient_gp_form: patientGpForm,
  patient_photo_form: patientPhotoForm,
  patient_link_form: patientLinkForm,
  vitals_dashboard: vitalsDashboard,
  vitals_table: vitalsTable,
  appointment_create_form: appointmentCreateForm,
  appointment_pick_practitioner_form: appointmentPickPractitionerForm,
  appointment_pick_slot_form: appointmentPickSlotForm,
  appointment_confirm_booking_form: appointmentConfirmBookingForm,
  org_create_form: orgCreateForm,
  org_location_create_form: orgLocationCreateForm,
  healthcare_service_create_form: healthcareServiceCreateForm,
  practitioner_create_form: practitionerCreateForm,
  practitioner_name_form: practitionerNameForm,
  practitioner_identifier_form: practitionerIdentifierForm,
  practitioner_telecom_form: practitionerTelecomForm,
  practitioner_qualification_form: practitionerQualificationForm,
  practitioner_communication_form: practitionerCommunicationForm,
  practitioner_role_create_form: practitionerRoleCreateForm,
  schedule_create_form: scheduleCreateForm,
  slot_create_form: slotCreateForm,
};
