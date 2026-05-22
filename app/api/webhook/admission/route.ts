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

  const { result, context } = runAdmissionAgent({
    patientId: parsed.data.patient_id,
    admissionsEmail: parsed.data.admissions_email,
    caseManagerEmail: parsed.data.case_manager_email,
    diagnosisIds: parsed.data.diagnosis_ids,
    serviceIds: parsed.data.service_ids,
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
      service_ids: ["rx_simple", "lab_basico"],
    },
  });
}
