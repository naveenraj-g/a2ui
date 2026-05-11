import patientCreateForm from "./patient_create_form.json";
import patientIdentifierForm from "./patient_identifier_form.json";
import patientTelecomForm from "./patient_telecom_form.json";
import patientAddressForm from "./patient_address_form.json";

/** Maps the workflow step's ui.schema name to the component tree JSON. */
export const UI_SCHEMA_REGISTRY: Record<string, unknown> = {
  patient_create_form: patientCreateForm,
  patient_identifier_form: patientIdentifierForm,
  patient_telecom_form: patientTelecomForm,
  patient_address_form: patientAddressForm,
};
