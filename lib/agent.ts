import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import {
  buildTools,
  buildCoverageSummary,
  type AgentContext,
  type SendResult,
} from "@/lib/tools";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { getPatient, getPolicy, getDiagnoses } from "@/lib/data";
import {
  sendOne,
  admissionsTemplate,
  caseManagerTemplate,
} from "@/lib/email";

const MODEL_PRIMARY = "gemini-2.5-flash";
const MODEL_FALLBACK = "gemini-3.1-flash-lite";

export type AgentParams = {
  patientId: string;
  admissionsEmail: string;
  caseManagerEmail: string;
  diagnosisIds: string[];
};

export function runAdmissionAgent(params: AgentParams) {
  const patient = getPatient(params.patientId);
  if (!patient) {
    throw new Error(`Paciente no encontrado: ${params.patientId}`);
  }

  const selectedDiagnoses = getDiagnoses(params.diagnosisIds);
  const totalAdmissionCost = selectedDiagnoses.reduce(
    (acc, d) => acc + d.cost_usd,
    0,
  );

  const ctx: AgentContext = {
    patientId: params.patientId,
    admissionsEmail: params.admissionsEmail,
    caseManagerEmail: params.caseManagerEmail,
    diagnosisIds: params.diagnosisIds,
    diagnosisLabel: selectedDiagnoses.map((d) => d.label).join(", "),
    sendState: { sent: false, result: null },
    validationState: {
      policy: null,
      copay: null,
      conditions: null,
      decision: null,
      analysis: null,
    },
  };

  const tools = buildTools(ctx);

  const userPayload = {
    event: "admission_to_emergency",
    today_date: new Date().toISOString().slice(0, 10),
    patient_id: patient.id,
    patient_name: patient.name,
    patient_age: patient.age,
    policy_id: patient.policy_id,
    current_diagnosis_ids: params.diagnosisIds,
    current_diagnosis_labels: selectedDiagnoses.map((d) => d.label),
    admission_time: patient.admission_time,
    admission_cost_usd: totalAdmissionCost,
    diagnoses: selectedDiagnoses.map((d) => ({
      id: d.id,
      label: d.label,
      cost_usd: d.cost_usd,
    })),
    clinical_notes: patient.clinical_notes,
    notification_recipients: {
      admissions_email: params.admissionsEmail,
      case_manager_email: params.caseManagerEmail,
    },
  };

  const result = streamText({
    model: google(modelFromEnv()),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Evento de admisión recibido:\n${JSON.stringify(userPayload, null, 2)}\n\nProcede según el protocolo obligatorio.`,
      },
    ],
    tools,
    stopWhen: stepCountIs(6),
    temperature: 0.2,
    onFinish: async ({ steps }) => {
      // Safety net: ensure send_notifications was called.
      // If the model finished without invoking it, force a manual send.
      if (!ctx.sendState.sent) {
        syncValidationFromSteps(ctx, steps);
        const { decision, rationale } = inferDecisionFromSteps(steps);
        ctx.validationState.decision = decision;
        ctx.validationState.analysis = rationale;
        const policy = getPolicy(patient.policy_id);
        const today = new Date().toISOString().slice(0, 10);
        const policyStatus = policy
          ? policy.valid_until < today
            ? `vencida ${policy.valid_until}`
            : `vigente hasta ${policy.valid_until}`
          : "desconocida";
        const templateArgs = {
          patientName: patient.name,
          diagnosis: ctx.diagnosisLabel || "sin diagnóstico declarado",
          decision,
          rationale,
          policyPlan: policy?.plan ?? "desconocido",
          policyStatus,
        };
        try {
          const adm = admissionsTemplate(templateArgs);
          const cm = caseManagerTemplate(templateArgs);
          const [admRes, cmRes] = await Promise.all([
            sendOne({
              to: params.admissionsEmail,
              subject: adm.subject,
              body: adm.body,
            }),
            sendOne({
              to: params.caseManagerEmail,
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
          console.warn("[agent.safety-net] forced send_notifications", result);
        } catch (e) {
          console.error("[agent.safety-net] forced send failed", e);
        }
      }
    },
    onError: ({ error }) => {
      console.error("[agent.streamText] error", error);
    },
  });

  return { result, context: ctx, coverage: () => buildCoverageSummary(ctx.validationState) };
}

function modelFromEnv() {
  if (process.env.GEMINI_MODEL_OVERRIDE) {
    return process.env.GEMINI_MODEL_OVERRIDE;
  }
  if (process.env.GEMINI_USE_FALLBACK === "1") {
    return MODEL_FALLBACK;
  }
  return MODEL_PRIMARY;
}

type StepLike = {
  toolCalls?: Array<{ toolName?: string }>;
  toolResults?: Array<{ toolName?: string; output?: unknown }>;
};

function syncValidationFromSteps(ctx: AgentContext, steps: StepLike[]) {
  for (const step of steps) {
    for (const r of step.toolResults ?? []) {
      const out = r.output as Record<string, unknown> | undefined;
      if (!out) continue;
      if (r.toolName === "validate_policy" && !ctx.validationState.policy) {
        ctx.validationState.policy = out as AgentContext["validationState"]["policy"];
      }
      if (r.toolName === "check_preexisting_conditions" && !ctx.validationState.conditions) {
        ctx.validationState.conditions = out as AgentContext["validationState"]["conditions"];
      }
      if (r.toolName === "compute_copay" && !ctx.validationState.copay) {
        ctx.validationState.copay = out as AgentContext["validationState"]["copay"];
      }
    }
    for (const c of step.toolCalls ?? []) {
      if (c.toolName !== "send_notifications") continue;
      const input = (c as { input?: { decision?: string; rationale?: string } }).input;
      if (input?.decision) ctx.validationState.decision = input.decision;
      if (input?.rationale) ctx.validationState.analysis = input.rationale;
    }
  }
}

function inferDecisionFromSteps(steps: StepLike[]) {
  let validUntil: string | null = null;
  let diagnosisExcluded: boolean | null = null;
  let coveragePct: number | null = null;
  let copay: number | null = null;

  for (const step of steps) {
    for (const r of step.toolResults ?? []) {
      const out = r.output as Record<string, unknown> | undefined;
      if (!out) continue;
      if (r.toolName === "validate_policy") {
        if (typeof out.valid_until === "string") validUntil = out.valid_until;
        if (typeof out.coverage_pct === "number")
          coveragePct = out.coverage_pct;
      }
      if (r.toolName === "check_preexisting_conditions") {
        if (typeof out.diagnosis_excluded === "boolean")
          diagnosisExcluded = out.diagnosis_excluded;
      }
      if (r.toolName === "compute_copay") {
        if (typeof out.patient_copay_usd === "number")
          copay = out.patient_copay_usd;
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const policyActive =
    validUntil !== null && validUntil !== "" && validUntil >= today;

  let decision = "Caso ambiguo";
  if (!policyActive) {
    decision = "Cobertura denegada";
  } else if (diagnosisExcluded === true) {
    decision = "Cobertura parcial";
  } else if (coveragePct !== null && coveragePct >= 80) {
    decision = "Cobertura plena";
  }

  const rationale = `Decisión generada por el sistema de respaldo. Vigencia: ${policyActive ? `vigente hasta ${validUntil}` : `vencida ${validUntil ?? "fecha desconocida"}`}. Cobertura: ${coveragePct ?? "n/a"}%. Diagnóstico excluido: ${diagnosisExcluded ?? "n/a"}.${copay !== null ? ` Copago estimado: $${copay}.` : ""}`;

  return { decision, rationale };
}
