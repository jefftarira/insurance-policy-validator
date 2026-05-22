import { runAdmissionAgent } from "@/lib/agent";
import { AdmissionEventSchema } from "@/lib/types";
import { checkRateLimit, extractClientIp, rateLimitResponse } from "@/lib/ratelimit";
import { type UIMessage, convertToModelMessages } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  messages: UIMessage[];
  data?: {
    patient_id?: string;
    admissions_email?: string;
    case_manager_email?: string;
    diagnosis_ids?: string[];
  };
};

export async function POST(req: Request) {
  const decision = checkRateLimit(extractClientIp(req));
  if (!decision.ok) {
    return rateLimitResponse(decision);
  }

  const body = (await req.json()) as ChatBody;

  // The client sends form params via `data` field of useChat.sendMessage
  const params = AdmissionEventSchema.safeParse({
    patient_id: body.data?.patient_id,
    admissions_email: body.data?.admissions_email,
    case_manager_email: body.data?.case_manager_email,
    diagnosis_ids: body.data?.diagnosis_ids,
  });

  if (!params.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid input",
        details: params.error.issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Sanity check: ensure we have messages from client; convertToModelMessages
  // is called inside the agent if we ever switch to extending conversations.
  void convertToModelMessages;

  const { result } = runAdmissionAgent({
    patientId: params.data.patient_id,
    admissionsEmail: params.data.admissions_email,
    caseManagerEmail: params.data.case_manager_email,
    diagnosisIds: params.data.diagnosis_ids,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
  });
}
