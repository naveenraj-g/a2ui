import { z } from "zod";

export const appointmentCreateSchema = z
  .object({
    patient_id: z.preprocess(
      (v) => (v === undefined || v === null || (typeof v === "number" && isNaN(v)) ? -1 : Number(v)),
      z.number().int().positive("Patient ID is required"),
    ),
    practitioner_ref_id: z.preprocess(
      (v) => (v === undefined || v === null || String(v) === "" ? -1 : Number(v)),
      z.number().int().positive("Please select a practitioner"),
    ),
    practitioner_display: z.string().optional(),
    status: z.string().min(1, "Status is required"),
    appointment_type_code: z.string().optional(),
    appointment_type_system: z.string().optional(),
    appointment_type_display: z.string().optional(),
    appointment_type_text: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    minutes_duration: z.number().int().min(1).optional(),
    description: z.string().optional(),
  })
  .transform((d) => ({
    status: d.status,
    subject: `Patient/${d.patient_id}`,
    start: d.start || undefined,
    end: d.end || undefined,
    minutes_duration: d.minutes_duration,
    description: d.description,
    appointment_type_code: d.appointment_type_code || undefined,
    appointment_type_system: d.appointment_type_system || undefined,
    appointment_type_display: d.appointment_type_display || undefined,
    appointment_type_text: d.appointment_type_text || undefined,
    participant: [
      {
        reference: `Patient/${d.patient_id}`,
        status: "accepted",
      },
      {
        reference: `Practitioner/${d.practitioner_ref_id}`,
        reference_display: d.practitioner_display || undefined,
        status: "needs-action",
      },
    ],
  }));
