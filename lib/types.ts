import { z } from "zod";

export const PatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  policy_id: z.string(),
  admission_time: z.string(),
  clinical_notes: z.string(),
});

export const PoliciesSchema = z.record(
  z.string(),
  z.object({
    policy_id: z.string(),
    patient_id: z.string(),
    plan: z.string(),
    valid_until: z.string(),
    deductible_usd: z.number(),
    coverage_pct: z.number(),
  }),
);

export const ConditionsSchema = z.record(
  z.string(),
  z.object({
    patient_id: z.string(),
    declared_conditions: z.array(z.string()),
    excluded_diagnoses: z.array(z.string()),
  }),
);

export const PatientsSchema = z.record(z.string(), PatientSchema);

export const CatalogItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  cost_usd: z.number(),
});

export const ProceduresSchema = z.record(z.string(), CatalogItemSchema);
export const DiagnosesSchema = z.record(z.string(), CatalogItemSchema);

// Kept as an alias for existing imports; same shape as CatalogItem.
export const ProcedureSchema = CatalogItemSchema;

export type Patient = z.infer<typeof PatientSchema>;
export type Policy = z.infer<typeof PoliciesSchema>[string];
export type Conditions = z.infer<typeof ConditionsSchema>[string];
export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type Procedure = CatalogItem;
export type Diagnosis = CatalogItem;

export const AdmissionEventSchema = z.object({
  patient_id: z.string().min(1),
  admissions_email: z.email(),
  case_manager_email: z.email(),
  diagnosis_ids: z.array(z.string()).min(1),
  service_ids: z.array(z.string()).optional(),
});

export type AdmissionEvent = z.infer<typeof AdmissionEventSchema>;

export const NotificationResultSchema = z.object({
  success: z.boolean(),
  admissions_message_id: z.string().nullable(),
  case_manager_message_id: z.string().nullable(),
  error: z.string().nullable(),
});

export type NotificationResult = z.infer<typeof NotificationResultSchema>;
