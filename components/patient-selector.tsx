"use client";

import type { Patient } from "@/lib/types";

type Props = {
  patients: Record<string, Patient>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export function PatientSelector({
  patients,
  selectedId,
  onSelect,
  disabled,
}: Props) {
  const ids = ["P1", "P2", "P3", "P4"];
  return (
    <div
      role="radiogroup"
      aria-label="Pacientes disponibles"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
    >
      {ids.map((id) => {
        const patient = patients[id];
        if (!patient) return null;
        const selected = selectedId === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(id)}
            className={[
              "flex flex-col gap-1 items-start text-left",
              "bg-[var(--surface)] rounded-md px-3 py-2.5",
              "transition-[border-color,background] duration-150",
              "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              selected
                ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-[11px] py-[9px]"
                : "border border-[var(--border)] hover:border-[var(--text-muted)]",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 min-w-0 w-full">
              <span className="font-mono text-[11px] font-medium text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-[3px] flex-shrink-0">
                {patient.id}
              </span>
              <span className="font-display font-bold text-[15px] leading-[18px] text-[var(--text)] truncate">
                {patient.name}
              </span>
            </div>
            <p className="text-[12px] leading-[16px] text-[var(--text-muted)] truncate w-full">
              {patient.age} años · {patient.current_diagnosis_label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
