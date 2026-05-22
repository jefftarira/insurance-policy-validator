import patientsRaw from "@/data/patients.json";
import policiesRaw from "@/data/policies.json";
import conditionsRaw from "@/data/conditions.json";
import proceduresRaw from "@/data/procedures.json";
import diagnosesRaw from "@/data/diagnoses.json";
import {
  PatientsSchema,
  PoliciesSchema,
  ConditionsSchema,
  ProceduresSchema,
  DiagnosesSchema,
  type CatalogItem,
} from "@/lib/types";

export const patients = PatientsSchema.parse(patientsRaw);
export const policies = PoliciesSchema.parse(policiesRaw);
export const conditions = ConditionsSchema.parse(conditionsRaw);
export const procedures = ProceduresSchema.parse(proceduresRaw);
export const diagnoses = DiagnosesSchema.parse(diagnosesRaw);

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

export function getProcedures(ids: string[]): CatalogItem[] {
  return ids.map((id) => procedures[id]).filter((p): p is CatalogItem => !!p);
}

export function getDiagnoses(ids: string[]): CatalogItem[] {
  return ids.map((id) => diagnoses[id]).filter((d): d is CatalogItem => !!d);
}

export function sumProcedureCost(ids: string[]): number {
  return getProcedures(ids).reduce((acc, p) => acc + p.cost_usd, 0);
}

export function sumDiagnosisCost(ids: string[]): number {
  return getDiagnoses(ids).reduce((acc, d) => acc + d.cost_usd, 0);
}
