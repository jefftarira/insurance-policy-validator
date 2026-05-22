import patientsRaw from "@/data/patients.json";
import policiesRaw from "@/data/policies.json";
import conditionsRaw from "@/data/conditions.json";
import {
  PatientsSchema,
  PoliciesSchema,
  ConditionsSchema,
} from "@/lib/types";

export const patients = PatientsSchema.parse(patientsRaw);
export const policies = PoliciesSchema.parse(policiesRaw);
export const conditions = ConditionsSchema.parse(conditionsRaw);

export function getPatient(id: string) {
  return patients[id];
}

export function getPolicy(policyId: string) {
  return policies[policyId];
}

export function getConditions(patientId: string) {
  return conditions[patientId] ?? {
    patient_id: patientId,
    declared_conditions: [],
    excluded_diagnoses: [],
  };
}
