"use client";

type Status = "running" | "done" | "error";

type Props = {
  name: string;
  status: Status;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
};

function statusColor(status: Status): string {
  if (status === "done") return "var(--accent)";
  if (status === "error") return "var(--alert)";
  return "var(--running)";
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function summarize(name: string, status: Status, input: unknown, output: unknown, error?: string): string {
  if (status === "error") return error ?? "error";

  const inp = asObject(input);
  const out = asObject(output);

  if (name === "validate_policy") {
    if (status === "running") {
      const id = inp?.policy_id;
      return id ? `verificando póliza ${id}…` : "verificando póliza…";
    }
    if (!out) return "sin resultado";
    if (out.found === false) return `Póliza ${out.policy_id ?? ""} no encontrada`;
    return `${out.plan} · vence ${out.valid_until} · ${out.coverage_pct}% cobertura · deducible $${out.deductible_usd}`;
  }

  if (name === "check_preexisting_conditions") {
    if (status === "running") return "revisando pre-existencias…";
    if (!out) return "sin resultado";
    const declared = Array.isArray(out.declared_conditions)
      ? (out.declared_conditions as string[])
      : [];
    const declaredLabel = declared.length > 0 ? declared.join(", ") : "ninguna";
    if (out.diagnosis_excluded === true) {
      return `Diagnóstico excluido (declarado: ${declaredLabel})`;
    }
    if (declared.length === 0) return "Sin pre-existencias relevantes";
    return `Sin exclusión (declarado: ${declaredLabel})`;
  }

  if (name === "compute_copay") {
    if (status === "running") return "calculando copago…";
    if (!out) return "sin resultado";
    const cost = out.admission_cost_usd ?? 0;
    const covered = out.covered_by_policy_usd ?? 0;
    const copay = out.patient_copay_usd ?? 0;
    return `Costo $${cost} · cubre $${covered} · copago $${copay}`;
  }

  if (name === "send_notifications") {
    if (status === "running") return "enviando notificaciones…";
    if (!out) return "sin resultado";
    if (out.success === true) return "2 emails enviados (admisiones + gestor)";
    return `Error: ${out.error ?? "envío falló"}`;
  }

  if (status === "running") return "ejecutando…";
  return "completado";
}

function friendlyName(name: string): string {
  if (name === "validate_policy") return "Póliza";
  if (name === "check_preexisting_conditions") return "Pre-existencias";
  if (name === "compute_copay") return "Copago";
  if (name === "send_notifications") return "Notificaciones";
  return name;
}

function statusBadge(status: Status, durationMs?: number): string {
  if (status === "running") return "running";
  if (status === "error") return "error";
  if (durationMs != null) return `done · ${durationMs}ms`;
  return "done";
}

export function ToolCard({ name, status, durationMs, input, output, error }: Props) {
  const dotColor = statusColor(status);
  const summary = summarize(name, status, input, output, error);
  const badge = statusBadge(status, durationMs);

  return (
    <article className="fade-in flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-md px-4 py-2.5 min-w-0">
      <span
        className={status === "running" ? "pulse-dot" : ""}
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: dotColor,
          flexShrink: 0,
        }}
        aria-hidden
      />
      <span className="font-body text-[13px] font-semibold text-[var(--text)] flex-shrink-0">
        {friendlyName(name)}
      </span>
      <span className="text-[var(--text-muted)] flex-shrink-0" aria-hidden>
        →
      </span>
      <span className="font-body text-[13px] text-[var(--text)] truncate flex-1 min-w-0">
        {summary}
      </span>
      <span
        className="font-mono text-[11px] flex-shrink-0"
        style={{ color: status === "running" ? "var(--running)" : "var(--text-muted)" }}
      >
        {badge}
      </span>
    </article>
  );
}
