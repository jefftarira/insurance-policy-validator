"use client";

import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import type { Patient } from "@/lib/types";
import { ToolCard } from "./tool-card";

type Props = {
  messages: UIMessage[];
  status: "idle" | "submitted" | "streaming" | "ready" | "error";
  errorMessage?: string;
  patient?: Patient | null;
};

// Helper: walk message parts and split into renderable items in order.
type RenderItem =
  | { kind: "text"; text: string; key: string }
  | {
      kind: "tool";
      name: string;
      status: "running" | "done" | "error";
      input?: unknown;
      output?: unknown;
      error?: string;
      key: string;
      durationMs?: number;
    };

type ToolPart = {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type TextPart = {
  type: "text";
  text?: string;
};

type AnyPart = (TextPart | ToolPart) & { [k: string]: unknown };

function isToolPart(p: AnyPart): p is ToolPart {
  return typeof p.type === "string" && p.type.startsWith("tool-");
}

function toolStatusFromState(state?: string): "running" | "done" | "error" {
  if (state === "output-available") return "done";
  if (state === "output-error") return "error";
  return "running";
}

type ErrorView =
  | { kind: "rate_limit"; scope: "api" | "gemini"; retrySeconds: number | null }
  | { kind: "plain"; message: string };

function classifyError(raw?: string): ErrorView {
  if (!raw) return { kind: "plain", message: "Ocurrió un error ejecutando el agente." };

  // Our own API rate limit (from lib/ratelimit.ts)
  if (raw.includes('"error":"rate_limit"') || raw.includes("Rate limit por IP") || raw.includes("Rate limit global")) {
    const m =
      raw.match(/"retry_after_seconds":\s*(\d+)/) ||
      raw.match(/Reintenta en (\d+)s/);
    return {
      kind: "rate_limit",
      scope: "api",
      retrySeconds: m ? parseInt(m[1], 10) : null,
    };
  }

  // Upstream Gemini rate limit
  const isGemini =
    raw.includes("exceeded your current quota") ||
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("free_tier_requests") ||
    raw.includes("429");
  if (isGemini) {
    const m = raw.match(/retry in ([\d.]+)s/);
    return {
      kind: "rate_limit",
      scope: "gemini",
      retrySeconds: m ? Math.ceil(parseFloat(m[1])) : null,
    };
  }

  return { kind: "plain", message: raw };
}

function CountdownLabel({ initialSeconds }: { initialSeconds: number }) {
  const [secs, setSecs] = useState(initialSeconds);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs]);
  if (secs <= 0) return <span className="font-medium">listo para reintentar</span>;
  return (
    <span className="font-mono font-medium" aria-live="polite">
      {secs}s
    </span>
  );
}

function RateLimitMessage({ scope, retrySeconds }: { scope: "api" | "gemini"; retrySeconds: number | null }) {
  const headline =
    scope === "api"
      ? "Rate limit del demo alcanzado."
      : "Rate limit de Gemini alcanzado (free tier).";
  return (
    <p className="text-[14px] text-[var(--alert)]">
      {headline}{" "}
      {retrySeconds != null ? (
        <>
          Reintenta en <CountdownLabel initialSeconds={retrySeconds} />.
        </>
      ) : (
        "Reintenta en ~30s."
      )}
    </p>
  );
}

function flatten(messages: UIMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let textIdx = 0;
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const parts = (msg.parts ?? []) as AnyPart[];
    for (const p of parts) {
      if (p.type === "text") {
        const text = (p as TextPart).text ?? "";
        if (text.trim().length > 0) {
          items.push({ kind: "text", text, key: `t-${msg.id}-${textIdx++}` });
        }
        continue;
      }
      if (isToolPart(p)) {
        const name = p.type.replace(/^tool-/, "");
        const status = toolStatusFromState(p.state);
        items.push({
          kind: "tool",
          name,
          status,
          input: p.input,
          output: p.output,
          error: p.errorText,
          key: `tool-${p.toolCallId ?? `${msg.id}-${name}`}`,
        });
      }
    }
  }
  return items;
}

type ToolOutputs = {
  policy?: {
    plan?: string;
    valid_until?: string;
    coverage_pct?: number;
    deductible_usd?: number;
    found?: boolean;
  };
  conditions?: {
    diagnosis_excluded?: boolean;
  };
  copay?: {
    admission_cost_usd?: number;
    patient_copay_usd?: number;
  };
};

function extractToolOutputs(messages: UIMessage[]): ToolOutputs {
  const out: ToolOutputs = {};
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const parts = (msg.parts ?? []) as AnyPart[];
    for (const p of parts) {
      if (!isToolPart(p)) continue;
      if (p.state !== "output-available") continue;
      const name = p.type.replace(/^tool-/, "");
      if (name === "validate_policy") out.policy = p.output as ToolOutputs["policy"];
      else if (name === "check_preexisting_conditions") out.conditions = p.output as ToolOutputs["conditions"];
      else if (name === "compute_copay") out.copay = p.output as ToolOutputs["copay"];
    }
  }
  return out;
}

type Decision = {
  policyLabel: string;
  policyColor: string;
  decisionLabel: string;
  decisionColor: string;
  amountLabel: string;
  amountSublabel: string;
};

function deriveDecision(outputs: ToolOutputs, patient?: Patient | null): Decision | null {
  const { policy, conditions, copay } = outputs;
  if (!policy) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expired = !!policy.valid_until && policy.valid_until < today;
  const excluded = conditions?.diagnosis_excluded === true;
  const notFound = policy.found === false;

  const policyLabel = notFound
    ? "No encontrada"
    : `${policy.plan ?? "—"} · ${expired ? `vencida ${policy.valid_until}` : `vigente ${policy.valid_until}`}`;
  const policyColor = notFound || expired ? "var(--alert)" : "var(--success)";

  let decisionLabel: string;
  let decisionColor: string;
  if (notFound) {
    decisionLabel = "Póliza no encontrada";
    decisionColor = "var(--alert)";
  } else if (expired) {
    decisionLabel = "Cobertura denegada · vencida";
    decisionColor = "var(--alert)";
  } else if (excluded) {
    decisionLabel = "Cobertura denegada · exclusión";
    decisionColor = "var(--alert)";
  } else if (copay) {
    decisionLabel = "Cobertura aprobada";
    decisionColor = "var(--success)";
  } else if (conditions) {
    decisionLabel = "Calculando copago…";
    decisionColor = "var(--running)";
  } else {
    decisionLabel = "Analizando…";
    decisionColor = "var(--running)";
  }

  let amountLabel: string;
  let amountSublabel: string;
  if (copay && typeof copay.patient_copay_usd === "number") {
    amountLabel = `$${copay.patient_copay_usd}`;
    amountSublabel = `copago · costo total $${copay.admission_cost_usd ?? "—"}`;
  } else if ((expired || excluded || notFound) && patient) {
    amountLabel = `$${patient.admission_cost_usd}`;
    amountSublabel = "paciente paga total";
  } else {
    amountLabel = "—";
    amountSublabel = "esperando cálculo";
  }

  return {
    policyLabel,
    policyColor,
    decisionLabel,
    decisionColor,
    amountLabel,
    amountSublabel,
  };
}

function DecisionBanner({ decision }: { decision: Decision }) {
  return (
    <div className="border border-[var(--border)] rounded-md bg-[var(--surface-2)] px-4 py-3 mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <BannerCell label="Póliza" value={decision.policyLabel} color={decision.policyColor} />
      <BannerCell label="Decisión" value={decision.decisionLabel} color={decision.decisionColor} />
      <BannerCell label="Paciente paga" value={decision.amountLabel} sublabel={decision.amountSublabel} mono />
    </div>
  );
}

function BannerCell({
  label,
  value,
  sublabel,
  color,
  mono,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </p>
      <p
        className={[
          "text-[14px] font-semibold leading-[18px] truncate",
          mono ? "font-mono" : "",
        ].join(" ")}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
          {sublabel}
        </p>
      )}
    </div>
  );
}

function groupParallelTools(items: RenderItem[]): Array<RenderItem | RenderItem[]> {
  // Group consecutive tool items with names validate_policy/check_preexisting_conditions
  // into a single pair when they appear back-to-back.
  const out: Array<RenderItem | RenderItem[]> = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    if (
      a.kind === "tool" &&
      (a.name === "validate_policy" || a.name === "check_preexisting_conditions")
    ) {
      const b = items[i + 1];
      if (
        b &&
        b.kind === "tool" &&
        (b.name === "validate_policy" ||
          b.name === "check_preexisting_conditions") &&
        b.name !== a.name
      ) {
        out.push([a, b]);
        i += 2;
        continue;
      }
    }
    out.push(a);
    i += 1;
  }
  return out;
}

export function AgentTimeline({ messages, status, errorMessage, patient }: Props) {
  const items = flatten(messages);
  const grouped = groupParallelTools(items);
  const isStreaming = status === "submitted" || status === "streaming";
  const hasContent = grouped.length > 0;
  const outputs = extractToolOutputs(messages);
  const decision = deriveDecision(outputs, patient);

  return (
    <section
      aria-label="Agent timeline"
      className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-5 min-h-[240px] min-w-0 overflow-hidden"
    >
      <header className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center justify-between">
        <span>Agent timeline</span>
        {isStreaming && (
          <span style={{ color: "var(--running)" }} className="font-medium">
            ● en vivo
          </span>
        )}
        {status === "ready" && hasContent && (
          <span style={{ color: "var(--success)" }} className="font-medium">
            ● completado
          </span>
        )}
        {status === "error" && (
          <span style={{ color: "var(--alert)" }} className="font-medium">
            ● error
          </span>
        )}
      </header>

      {decision && <DecisionBanner decision={decision} />}

      {!hasContent && !isStreaming && status !== "error" && (
        <p className="text-[14px] text-[var(--text-muted)] italic">
          Selecciona un paciente, completa los emails y dispara el agente.
        </p>
      )}

      {isStreaming && !hasContent && (
        <p className="text-[14px] text-[var(--text-muted)] italic">
          Iniciando análisis…
        </p>
      )}

      {status === "error" && (() => {
        const view = classifyError(errorMessage);
        if (view.kind === "rate_limit") {
          return <RateLimitMessage scope={view.scope} retrySeconds={view.retrySeconds} />;
        }
        return <p className="text-[14px] text-[var(--alert)]">{view.message}</p>;
      })()}

      <div className="flex flex-col gap-2 min-w-0">
        {grouped.map((entry, idx) => {
          if (Array.isArray(entry)) {
            // Parallel pair
            return (
              <div
                key={`pair-${idx}`}
                className="grid grid-cols-1 md:grid-cols-2 gap-2 min-w-0"
              >
                {entry.map((it) => (
                  <ToolCard
                    key={it.key}
                    name={(it as Extract<RenderItem, { kind: "tool" }>).name}
                    status={(it as Extract<RenderItem, { kind: "tool" }>).status}
                    input={(it as Extract<RenderItem, { kind: "tool" }>).input}
                    output={(it as Extract<RenderItem, { kind: "tool" }>).output}
                    error={(it as Extract<RenderItem, { kind: "tool" }>).error}
                  />
                ))}
              </div>
            );
          }
          if (entry.kind === "text") {
            return (
              <p
                key={entry.key}
                className="fade-in border-l-2 border-[var(--border)] pl-4 py-2 text-[14px] text-[var(--text-muted)] italic"
              >
                {entry.text}
              </p>
            );
          }
          return (
            <ToolCard
              key={entry.key}
              name={entry.name}
              status={entry.status}
              input={entry.input}
              output={entry.output}
              error={entry.error}
            />
          );
        })}
      </div>
    </section>
  );
}
