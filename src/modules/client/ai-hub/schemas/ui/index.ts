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
};
