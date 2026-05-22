"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PatientSelector } from "@/components/patient-selector";
import { CatalogSelector } from "@/components/catalog-selector";
import { EmailInputs } from "@/components/email-inputs";
import { AgentTimeline } from "@/components/agent-timeline";
import { EmailPreviews } from "@/components/email-preview";
import patientsRaw from "@/data/patients.json";
import diagnosesRaw from "@/data/diagnoses.json";
import { PatientsSchema, DiagnosesSchema } from "@/lib/types";

const patients = PatientsSchema.parse(patientsRaw);
const diagnoses = DiagnosesSchema.parse(diagnosesRaw);

function validEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function Home() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [diagnosisIds, setDiagnosisIds] = useState<string[]>([]);
  const [admissionsEmail, setAdmissionsEmail] = useState("");
  const [caseManagerEmail, setCaseManagerEmail] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [origin, setOrigin] = useState("$URL");

  function toggleDiagnosis(id: string) {
    setDiagnosisIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  useEffect(() => {
    const stored = localStorage.getItem("er-theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
    setOrigin(window.location.origin);
    fetch("/api/health").catch(() => {});
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("er-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onFinish: () => setEndedAt(Date.now()),
    onError: () => setEndedAt(Date.now()),
  });

  const formReady =
    patientId !== null &&
    diagnosisIds.length > 0 &&
    validEmail(admissionsEmail) &&
    validEmail(caseManagerEmail);

  const isRunning = status === "submitted" || status === "streaming";

  function trigger() {
    if (!formReady || isRunning) return;
    setMessages([]);
    setStartedAt(Date.now());
    setEndedAt(null);
    sendMessage(
      { text: `Procesar admisión del paciente ${patientId}.` },
      {
        body: {
          data: {
            patient_id: patientId,
            admissions_email: admissionsEmail,
            case_manager_email: caseManagerEmail,
            diagnosis_ids: diagnosisIds,
          },
        },
      },
    );
  }

  const selectedPatient = patientId ? patients[patientId] : null;
  const totalAdmissionCost = diagnosisIds.reduce(
    (acc, id) => acc + (diagnoses[id]?.cost_usd ?? 0),
    0,
  );
  const selectedDiagnosisLabels = diagnosisIds
    .map((id) => diagnoses[id]?.label)
    .filter((l): l is string => !!l);
  const diagnosisLabelById = useMemo(
    () =>
      Object.fromEntries(
        Object.values(diagnoses).map((d) => [d.id, d.label]),
      ) as Record<string, string>,
    [],
  );
  const elapsedMs =
    startedAt && endedAt
      ? endedAt - startedAt
      : startedAt
        ? Date.now() - startedAt
        : null;

  const curlSnippet = useMemo(() => {
    const p = patientId ?? "P1";
    const adm = admissionsEmail || "admisiones@hospital.demo";
    const cm = caseManagerEmail || "gestor@aseguradora.demo";
    const dx = diagnosisIds.length > 0 ? diagnosisIds : ["apendicitis_aguda"];
    return `curl -X POST ${origin}/api/webhook/admission \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_id": "${p}",
    "admissions_email": "${adm}",
    "case_manager_email": "${cm}",
    "diagnosis_ids": ${JSON.stringify(dx)}
  }'`;
  }, [patientId, admissionsEmail, caseManagerEmail, diagnosisIds, origin]);

  return (
    <main className="container mx-auto max-w-[1280px] px-4 sm:px-8 py-6 sm:py-10 flex-1">
      <Header onToggleTheme={toggleTheme} theme={theme} />

      <h1 className="font-display font-black text-[36px] sm:text-[56px] leading-[1.05] -tracking-[0.03em] mt-4 mb-2 text-[var(--text)]">
        Procesar ingreso a emergencia
      </h1>
      <p className="text-[15px] sm:text-[16px] leading-[24px] text-[var(--text-muted)] max-w-[720px] mb-7">
        Selecciona un paciente precargado, ingresa los emails del departamento
        de admisiones y del gestor de casos del seguro, y dispara el agente IA
        que valida la póliza y notifica simultáneamente.
      </p>

      <SectionLabel step="01" label="Selecciona paciente" />
      <div className="mb-6">
        <PatientSelector
          patients={patients}
          selectedId={patientId}
          onSelect={setPatientId}
          disabled={isRunning}
        />
      </div>

      <SectionLabel step="02" label="Diagnósticos" />
      <div className="mb-6">
        <CatalogSelector
          diagnoses={diagnoses}
          selectedDiagnosisIds={diagnosisIds}
          onToggleDiagnosis={toggleDiagnosis}
          disabled={isRunning}
        />
      </div>

      <SectionLabel step="03" label="Emails de destino" />
      <div className="mb-5">
        <EmailInputs
          admissionsEmail={admissionsEmail}
          caseManagerEmail={caseManagerEmail}
          onAdmissionsChange={setAdmissionsEmail}
          onCaseManagerChange={setCaseManagerEmail}
          disabled={isRunning}
        />
      </div>

      <div className="border-t border-[var(--border)] pt-5 flex flex-wrap gap-4 items-center">
        <button
          type="button"
          onClick={trigger}
          disabled={!formReady || isRunning}
          className={[
            "font-body font-medium text-[15px] px-7 py-3.5 rounded",
            "bg-[var(--accent)] text-white border-0 cursor-pointer",
            "transition-[filter] duration-150",
            "hover:brightness-110",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
          ].join(" ")}
        >
          {isRunning ? "Procesando…" : "Procesar ingreso a emergencia"}
        </button>
        <div
          className="text-[13px] text-[var(--text-muted)]"
          aria-live="polite"
        >
          {formReady
            ? `Listo — paciente ${patientId} · ${diagnosisIds.length} diagnóstico${diagnosisIds.length === 1 ? "" : "s"} · 2 emails válidos.`
            : !patientId
              ? "Selecciona paciente."
              : diagnosisIds.length === 0
                ? "Selecciona al menos un diagnóstico."
                : "Completa los 2 emails."}
          {elapsedMs !== null && (
            <span className="ml-3 font-mono">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      <SectionLabel step="04" label="Agente en vivo" className="mt-9" />
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6">
        <AgentTimeline
          messages={messages}
          status={status}
          errorMessage={error?.message}
          patient={selectedPatient}
          totalAdmissionCost={totalAdmissionCost}
          diagnosisLabelById={diagnosisLabelById}
        />
        <EmailPreviews
          patient={selectedPatient}
          admissionsEmail={admissionsEmail}
          caseManagerEmail={caseManagerEmail}
          messages={messages}
          totalAdmissionCost={totalAdmissionCost}
          diagnosisLabels={selectedDiagnosisLabels}
        />
      </div>

      <section
        id="webhook"
        className="mt-9 bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-5 py-4"
      >
        <div className="flex justify-between items-center mb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Mismo flujo vía curl (webhook real)
          </p>
          <button
            type="button"
            className="font-body text-[11px] font-medium border border-[var(--border)] rounded text-[var(--text-muted)] px-2 py-0.5 bg-transparent cursor-pointer hover:text-[var(--text)]"
            onClick={() => navigator.clipboard.writeText(curlSnippet)}
          >
            Copy
          </button>
        </div>
        <pre className="font-mono text-[12px] leading-[18px] text-[var(--text)] whitespace-pre overflow-x-auto m-0">
          {curlSnippet}
        </pre>
      </section>
    </main>
  );
}

function Header({
  onToggleTheme,
  theme,
}: {
  onToggleTheme: () => void;
  theme: "light" | "dark" | null;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5 mb-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        <span className="font-display font-black text-[22px] leading-[26px] -tracking-[0.025em]">
          Insurance policy validator
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleTheme}
          className="font-body text-[13px] font-medium bg-transparent text-[var(--text)] border border-[var(--border)] rounded-md px-3.5 py-2 cursor-pointer hover:bg-[var(--surface-2)]"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}

function SectionLabel({
  step,
  label,
  className,
}: {
  step: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-3 flex items-center gap-2.5",
        className ?? "",
      ].join(" ")}
    >
      <span className="font-mono font-medium bg-[var(--surface-2)] text-[var(--text)] px-1.5 py-0.5 rounded-[3px]">
        {step}
      </span>
      <span>{label}</span>
    </div>
  );
}
