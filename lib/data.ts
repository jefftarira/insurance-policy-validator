import patientsRaw from "@/data/patients.json";
import policiesRaw from "@/data/policies.json";
import conditionsRaw from "@/data/conditions.json";
import proceduresRaw from "@/data/procedures.json";
import {
  PatientsSchema,
  PoliciesSchema,
  ConditionsSchema,
  ProceduresSchema,
  type Procedure,
} from "@/lib/types";

export const patients = PatientsSchema.parse(patientsRaw);
export const policies = PoliciesSchema.parse(policiesRaw);
export const conditions = ConditionsSchema.parse(conditionsRaw);
export const procedures = ProceduresSchema.parse(proceduresRaw);

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

export function getProcedures(ids: string[]): Procedure[] {
  return ids.map((id) => procedures[id]).filter((p): p is Procedure => !!p);
}

export function sumProcedureCost(ids: string[]): number {
  return getProcedures(ids).reduce((acc, p) => acc + p.cost_usd, 0);
}
