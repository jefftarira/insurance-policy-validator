import { tool } from "ai";
import { z } from "zod";
import { getPolicy, getConditions, getPatient } from "@/lib/data";
import {
  sendOne,
  admissionsTemplate,
  caseManagerTemplate,
} from "@/lib/email";
import type { CoverageSummary } from "@/lib/types";

export type PolicyToolResult = z.infer<typeof PolicyResult>;
export type CopayToolResult = z.infer<typeof CopayResult>;
export type ConditionsToolResult = z.infer<typeof ConditionsResult>;

export type AgentValidationState = {
  policy: PolicyToolResult | null;
  copay: CopayToolResult | null;
  conditions: ConditionsToolResult | null;
  decision: string | null;
  analysis: string | null;
};

export type AgentContext = {
  patientId: string;
  admissionsEmail: string;
  caseManagerEmail: string;
  diagnosisIds: string[];
  diagnosisLabel: string;
  sendState: { sent: boolean; result: SendResult | null };
  validationState: AgentValidationState;
};

function emptyValidationState(): AgentValidationState {
  return {
    policy: null,
    copay: null,
    conditions: null,
    decision: null,
    analysis: null,
  };
}

export function buildCoverageSummary(
  state: AgentValidationState,
): CoverageSummary {
  const today = new Date().toISOString().slice(0, 10);
  const policyActive =
    state.policy?.found === true && state.policy.valid_until >= today;

  let approved: boolean | null = null;
  if (state.decision === "Cobertura plena") {
    approved = true;
  } else if (
    state.decision === "Cobertura denegada" ||
    state.decision === "Cobertura parcial"
  ) {
    approved = false;
  }

  return {
    decision: state.decision,
    approved,
    policy_active: state.policy ? policyActive : null,
    copay_usd: state.copay?.patient_copay_usd ?? null,
    admission_cost_usd: state.copay?.admission_cost_usd ?? null,
    covered_by_policy_usd: state.copay?.covered_by_policy_usd ?? null,
    agent_analysis: state.analysis,
  };
}

export type SendResult = {
  success: boolean;
  admissions_message_id: string | null;
  case_manager_message_id: string | null;
  error: string | null;
};

const PolicyResult = z.object({
  policy_id: z.string(),
  plan: z.string(),
  valid_until: z.string(),
  deductible_usd: z.number(),
  coverage_pct: z.number(),
  found: z.boolean(),
});

const CopayResult = z.object({
  admission_cost_usd: z.number(),
  deductible_usd: z.number(),
  coverage_pct: z.number(),
  covered_by_policy_usd: z.number(),
  patient_copay_usd: z.number(),
  fully_covered: z.boolean(),
});

const ConditionsResult = z.object({
  patient_id: z.string(),
  declared_conditions: z.array(z.string()),
  excluded_diagnoses: z.array(z.string()),
  current_diagnoses: z.array(z.string()),
  excluded_matches: z.array(z.string()),
  diagnosis_excluded: z.boolean(),
});

export function buildTools(ctx: AgentContext) {
  return {
    validate_policy: tool({
      description:
        "Devuelve los datos de la póliza por policy_id: plan, valid_until (fecha de expiración), deductible y porcentaje de cobertura. El modelo DEBE inferir si la póliza está vigente comparando valid_until contra la fecha de hoy.",
      inputSchema: z.object({
        policy_id: z
          .string()
          .describe('ID de la póliza, formato "POL-NNNN"'),
      }),
      execute: async ({ policy_id }) => {
        const policy = getPolicy(policy_id);
        if (!policy) {
          const result = PolicyResult.parse({
            policy_id,
            plan: "desconocido",
            valid_until: "",
            deductible_usd: 0,
            coverage_pct: 0,
            found: false,
          });
          ctx.validationState.policy = result;
          return result;
        }
        const result = PolicyResult.parse({ ...policy, found: true });
        ctx.validationState.policy = result;
        return result;
      },
    }),

    compute_copay: tool({
      description:
        "Calcula cuánto cubre la póliza y cuánto paga el paciente (copago) para el costo del ingreso, dado el deducible y el porcentaje de cobertura. NO considera vigencia — si la póliza está vencida, el agente debe ignorar este resultado y denegar cobertura. Fórmula: si cost ≤ deductible → cubierto=0, copago=cost; si no → cubierto=(cost−deductible)×coverage_pct/100, copago=cost−cubierto.",
      inputSchema: z.object({
        admission_cost_usd: z
          .number()
          .describe("Costo total del ingreso a emergencia en USD."),
        deductible_usd: z
          .number()
          .describe("Deducible de la póliza en USD (de validate_policy)."),
        coverage_pct: z
          .number()
          .describe("Porcentaje de cobertura de la póliza (0-100, de validate_policy)."),
      }),
      execute: async ({ admission_cost_usd, deductible_usd, coverage_pct }) => {
        let covered = 0;
        if (admission_cost_usd > deductible_usd) {
          covered =
            ((admission_cost_usd - deductible_usd) * coverage_pct) / 100;
        }
        const copay = admission_cost_usd - covered;
        const result = CopayResult.parse({
          admission_cost_usd,
          deductible_usd,
          coverage_pct,
          covered_by_policy_usd: Math.round(covered * 100) / 100,
          patient_copay_usd: Math.round(copay * 100) / 100,
          fully_covered: copay <= deductible_usd && admission_cost_usd > 0,
        });
        ctx.validationState.copay = result;
        return result;
      },
    }),

    check_preexisting_conditions: tool({
      description:
        "Revisa las pre-existencias declaradas del paciente y si ALGUNO de los diagnósticos actuales está excluido por contrato. Cruza la lista de current_diagnoses contra excluded_diagnoses del contrato; devuelve excluded_matches con los que sí están excluidos.",
      inputSchema: z.object({
        patient_id: z.string().describe("ID del paciente"),
        current_diagnoses: z
          .array(z.string())
          .describe("IDs de los diagnósticos seleccionados para este ingreso"),
      }),
      execute: async ({ patient_id, current_diagnoses }) => {
        const cond = getConditions(patient_id);
        const matches = current_diagnoses.filter((d) =>
          cond.excluded_diagnoses.includes(d),
        );
        const result = ConditionsResult.parse({
          patient_id: cond.patient_id,
          declared_conditions: cond.declared_conditions,
          excluded_diagnoses: cond.excluded_diagnoses,
          current_diagnoses,
          excluded_matches: matches,
          diagnosis_excluded: matches.length > 0,
        });
        ctx.validationState.conditions = result;
        return result;
      },
    }),

    send_notifications: tool({
      description:
        "Envía las notificaciones a admisiones del hospital y al gestor de casos del seguro simultáneamente. SIEMPRE debe llamarse al final, incluso en denegación.",
      inputSchema: z.object({
        decision: z
          .string()
          .describe(
            'Decisión final: "Cobertura plena" | "Cobertura parcial" | "Cobertura denegada" | "Caso ambiguo"',
          ),
        rationale: z
          .string()
          .describe(
            "Razonamiento clínico-financiero, 2-4 oraciones para incluir en los emails.",
          ),
      }),
      execute: async ({ decision, rationale }) => {
        ctx.validationState.decision = decision;
        ctx.validationState.analysis = rationale;

        // Idempotency guard: if already sent in this request, return cached result
        if (ctx.sendState.sent && ctx.sendState.result) {
          return ctx.sendState.result;
        }

        const patient = getPatient(ctx.patientId);
        const policy = patient ? getPolicy(patient.policy_id) : null;
        const today = new Date().toISOString().slice(0, 10);
        const policyStatus = policy
          ? policy.valid_until < today
            ? `vencida ${policy.valid_until}`
            : `vigente hasta ${policy.valid_until}`
          : "desconocida";

        const args = {
          patientName: patient?.name ?? ctx.patientId,
          diagnosis: ctx.diagnosisLabel || "sin diagnóstico declarado",
          decision,
          rationale,
          policyPlan: policy?.plan ?? "desconocido",
          policyStatus,
        };

        const adm = admissionsTemplate(args);
        const cm = caseManagerTemplate(args);

        const [admRes, cmRes] = await Promise.all([
          sendOne({
            to: ctx.admissionsEmail,
            subject: adm.subject,
            body: adm.body,
          }),
          sendOne({
            to: ctx.caseManagerEmail,
            subject: cm.subject,
            body: cm.body,
          }),
        ]);

        const result: SendResult = {
          success: !admRes.error && !cmRes.error,
          admissions_message_id: admRes.id,
          case_manager_message_id: cmRes.id,
          error: admRes.error ?? cmRes.error ?? null,
        };

        ctx.sendState.sent = true;
        ctx.sendState.result = result;
        return result;
      },
    }),
  };
}
