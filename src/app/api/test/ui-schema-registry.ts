import createPatient from "@/a2ui/schemas/patient-form-post.json"
import listPatients from "@/a2ui/schemas/patient-list-get.json"
import updatePatientForm from "@/a2ui/schemas/patient-update-form.json"

export const uiSchemas: Record<string, { method: string; tool: string; schema: any }> = {
  create_patient: {
    method: "POST",
    tool: "create_patient",
    schema: createPatient
  },
  list_patients: {
    method: "GET",
    tool: "list_patients",
    schema: listPatients
  },
  update_patient_form: {
    method: "POST",
    tool: "update_patient",
    schema: updatePatientForm
  }
}