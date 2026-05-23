import { runAdmissionAgent } from "@/lib/agent";
import { AdmissionEventSchema } from "@/lib/types";
import { checkRateLimit, extractClientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const decision = checkRateLimit(extractClientIp(req));
  if (!decision.ok) {
    return rateLimitResponse(decision);
  }

  const body = await req.json();
  const parsed = AdmissionEventSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { result, context, coverage } = runAdmissionAgent({
    patientId: parsed.data.patient_id,
    admissionsEmail: parsed.data.admissions_email,
    caseManagerEmail: parsed.data.case_manager_email,
    diagnosisIds: parsed.data.diagnosis_ids,
  });

  // Block until stream finishes — webhook returns a synchronous JSON
  try {
    await result.consumeStream();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: "Agent execution failed", details: message },
      { status: 500 },
    );
  }

  const summary = context.sendState.result;
  const finalText = await result.text;

  return Response.json({
    ok: true,
    patient_id: parsed.data.patient_id,
    coverage: coverage(),
    notifications: summary,
    agent_summary: finalText,
  });
}

export async function GET() {
  return Response.json({
    info: "Insurance policy validator webhook endpoint",
    method: "POST",
    expected_payload: {
      patient_id: "P1 | P2 | P3 | P4",
      admissions_email: "admisiones@hospital.demo",
      case_manager_email: "gestor@aseguradora.demo",
      diagnosis_ids: ["apendicitis_aguda"],
    },
    response_fields: {
      coverage: {
        decision: "Cobertura plena | Cobertura parcial | Cobertura denegada | Caso ambiguo",
        approved: "true si cobertura plena; false si parcial o denegada",
        policy_active: "true si valid_until >= hoy",
        copay_usd: "copago del paciente en USD",
        admission_cost_usd: "costo total del ingreso",
        covered_by_policy_usd: "monto cubierto por la póliza",
        agent_analysis: "razonamiento clínico-financiero del agente",
      },
    },
  });
}
