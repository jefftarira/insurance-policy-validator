"use client";

import type { UIMessage } from "ai";
import type { Patient } from "@/lib/types";

type Props = {
  patient: Patient | null;
  admissionsEmail: string;
  caseManagerEmail: string;
  messages: UIMessage[];
};

type ToolPart = {
  type: string;
  state?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
};

function extractToolStates(messages: UIMessage[]) {
  const states: Record<string, {
    state: "running" | "done" | "error";
    input?: unknown;
    output?: unknown;
  }> = {};
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const parts = (msg.parts ?? []) as ToolPart[];
    for (const p of parts) {
      if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
      const name = p.type.replace(/^tool-/, "");
      const status: "running" | "done" | "error" =
        p.state === "output-available"
          ? "done"
          : p.state === "output-error"
          ? "error"
          : "running";
      states[name] = { state: status, input: p.input, output: p.output };
    }
  }
  return states;
}

function PreviewCard({
  recipientLabel,
  recipientEmail,
  patient,
  toolStates,
  variant,
}: {
  recipientLabel: string;
  recipientEmail: string;
  patient: Patient | null;
  toolStates: Record<string, { state: string; output?: unknown }>;
  variant: "admissions" | "case_manager";
}) {
  const policy = toolStates.validate_policy?.output as
    | { plan?: string; valid_until?: string; deductible_usd?: number; coverage_pct?: number }
    | undefined;
  const conditions = toolStates.check_preexisting_conditions?.output as
    | { diagnosis_excluded?: boolean; declared_conditions?: string[] }
    | undefined;
  const copay = toolStates.compute_copay?.output as
    | { admission_cost_usd?: number; covered_by_policy_usd?: number; patient_copay_usd?: number }
    | undefined;
  const sent = toolStates.send_notifications?.output as
    | { success?: boolean; admissions_message_id?: string; case_manager_message_id?: string }
    | undefined;

  const today = new Date().toISOString().slice(0, 10);
  const policyStatusLabel = policy?.valid_until
    ? policy.valid_until < today
      ? `vencida ${policy.valid_until}`
      : `vigente hasta ${policy.valid_until}`
    : null;

  const messageId = sent
    ? variant === "admissions"
      ? sent.admissions_message_id
      : sent.case_manager_message_id
    : undefined;

  return (
    <article className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-4">
        {recipientLabel}
      </p>

      <h3 className="font-display font-bold text-[24px] leading-[28px] -tracking-[0.015em] text-[var(--text)]">
        {patient ? `Caso: ${patient.name}` : "—"}
      </h3>
      <p className="font-body text-[15px] text-[var(--text-muted)] mt-1">
        {patient ? patient.current_diagnosis_label : "Sin paciente seleccionado"}
      </p>

      <hr className="my-5 border-0 border-t border-[var(--border)]" />

      <dl className="space-y-3 text-[14px]">
        <Row label="Para">
          <span className="font-mono text-[13px]">
            {recipientEmail || <em className="text-[var(--text-muted)] not-italic">pendiente…</em>}
          </span>
        </Row>
        <Row label="Cobertura">
          {policy ? (
            <span>
              Plan {policy.plan}
              {policyStatusLabel ? `, ${policyStatusLabel}` : ""}
              {policy.coverage_pct != null ? ` · ${policy.coverage_pct}% cobertura` : ""}
              {policy.deductible_usd != null ? ` · deducible $${policy.deductible_usd}` : ""}
            </span>
          ) : (
            <em className="text-[var(--text-muted)] not-italic">esperando análisis…</em>
          )}
        </Row>
        <Row label="Pre-existencias">
          {conditions ? (
            <span>
              {conditions.declared_conditions && conditions.declared_conditions.length > 0
                ? conditions.declared_conditions.join(", ")
                : "ninguna declarada"}
              {conditions.diagnosis_excluded
                ? " — diagnóstico actual EXCLUIDO por contrato"
                : ""}
            </span>
          ) : (
            <em className="text-[var(--text-muted)] not-italic">esperando análisis…</em>
          )}
        </Row>
        <Row label="Copago">
          {copay ? (
            <span>
              Costo ${copay.admission_cost_usd} · cubre ${copay.covered_by_policy_usd} · paciente paga ${copay.patient_copay_usd}
            </span>
          ) : (
            <em className="text-[var(--text-muted)] not-italic">esperando cálculo…</em>
          )}
        </Row>
        <Row label="Estado del envío">
          {sent?.success ? (
            <span style={{ color: "var(--success)" }} className="font-medium">
              ✓ Enviado · {messageId ? messageId.slice(0, 12) + "…" : ""}
            </span>
          ) : sent && !sent.success ? (
            <span style={{ color: "var(--alert)" }} className="font-medium">
              ✗ Falló envío
            </span>
          ) : (
            <em className="text-[var(--text-muted)] not-italic">aún no enviado</em>
          )}
        </Row>
      </dl>

      <p className="mt-5 pt-4 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
        Email final renderizado en Outfit. Subject + body completo se envían vía Resend.
      </p>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-[120px] shrink-0 mt-0.5">
        {label}
      </dt>
      <dd className="text-[14px] text-[var(--text)] flex-1">{children}</dd>
    </div>
  );
}

export function EmailPreviews({
  patient,
  admissionsEmail,
  caseManagerEmail,
  messages,
}: Props) {
  const toolStates = extractToolStates(messages);

  return (
    <aside aria-label="Preview de emails" className="flex flex-col gap-4">
      <PreviewCard
        recipientLabel="Admisiones — Hospital"
        recipientEmail={admissionsEmail}
        patient={patient}
        toolStates={toolStates}
        variant="admissions"
      />
      <PreviewCard
        recipientLabel="Gestor de Casos — Seguro"
        recipientEmail={caseManagerEmail}
        patient={patient}
        toolStates={toolStates}
        variant="case_manager"
      />
    </aside>
  );
}
