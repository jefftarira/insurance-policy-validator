import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = process.env.BREVO_SMTP_HOST ?? "smtp-relay.sendinblue.com";
const SMTP_PORT = Number(process.env.BREVO_SMTP_PORT ?? "587");
const SMTP_USER = process.env.BREVO_SMTP_USER;
const SMTP_PASS = process.env.BREVO_SMTP_PASS;
export const FROM_ADDRESS =
  process.env.EMAIL_FROM ??
  "Insurance policy validator <no-reply@example.com>";

let cached: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (cached) return cached;
  if (!SMTP_USER || !SMTP_PASS) return null;
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export async function sendOne(payload: EmailPayload) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[brevo] BREVO_SMTP_USER / BREVO_SMTP_PASS missing — skipping send", {
      to: payload.to,
    });
    return { id: null, error: "Brevo SMTP credentials not configured" };
  }
  try {
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
    });
    return { id: info.messageId ?? null, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { id: null, error: message };
  }
}

export function admissionsTemplate(args: {
  patientName: string;
  diagnosis: string;
  decision: string;
  rationale: string;
  policyPlan: string;
  policyStatus: string;
}) {
  return {
    subject: `[Admisión] Caso ${args.patientName} — ${args.decision}`,
    body: `Estimado equipo de admisiones,

Confirmamos el resultado del análisis de cobertura para el ingreso a emergencia:

Paciente: ${args.patientName}
Diagnóstico actual: ${args.diagnosis}
Póliza: Plan ${args.policyPlan} (${args.policyStatus})
Decisión: ${args.decision}

Razonamiento clínico-financiero:
${args.rationale}

Proceder según los protocolos internos de admisión.

Insurance policy validator`,
  };
}

export function caseManagerTemplate(args: {
  patientName: string;
  diagnosis: string;
  decision: string;
  rationale: string;
  policyPlan: string;
  policyStatus: string;
}) {
  return {
    subject: `[Gestor de Casos] ${args.patientName} — ${args.decision}`,
    body: `Estimado gestor,

Le notificamos el ingreso a emergencia procesado por el agente IA:

Paciente: ${args.patientName}
Diagnóstico actual: ${args.diagnosis}
Póliza: Plan ${args.policyPlan} (${args.policyStatus})
Decisión preliminar: ${args.decision}

Razonamiento:
${args.rationale}

Por favor revise el caso y haga seguimiento según corresponda.

Insurance policy validator`,
  };
}
