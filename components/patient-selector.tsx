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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
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
              "flex flex-col gap-2 items-start text-left",
              "bg-[var(--surface)]",
              "rounded-md p-5 min-h-[120px]",
              "transition-[border-color,background] duration-150",
              "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              selected
                ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-[19px]"
                : "border border-[var(--border)] hover:border-[var(--text-muted)]",
            ].join(" ")}
          >
            <h3 className="font-display font-bold text-[22px] leading-[26px] -tracking-[0.015em] text-[var(--text)]">
              {patient.name}
            </h3>
            <span className="text-[13px] text-[var(--text-muted)]">
              {patient.age} años
            </span>
            <p className="text-[14px] font-medium leading-[20px] text-[var(--text)] mt-auto">
              {patient.current_diagnosis_label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
