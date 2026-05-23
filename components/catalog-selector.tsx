"use client";

import type { CatalogItem } from "@/lib/types";

type Props = {
  diagnoses: Record<string, CatalogItem>;
  selectedDiagnosisIds: string[];
  onToggleDiagnosis: (id: string) => void;
  disabled?: boolean;
};

export function CatalogSelector({
  diagnoses,
  selectedDiagnosisIds,
  onToggleDiagnosis,
  disabled,
}: Props) {
  const diagnosisList = Object.values(diagnoses);
  const total = selectedDiagnosisIds.reduce(
    (acc, id) => acc + (diagnoses[id]?.cost_usd ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {diagnosisList.map((item) => {
          const selected = selectedDiagnosisIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onToggleDiagnosis(item.id)}
              className={[
                "flex items-start justify-between gap-3 text-left",
                "bg-[var(--surface)] rounded-md px-3 py-2",
                "transition-[border-color,background] duration-150",
                "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                selected
                  ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-[11px] py-[7px]"
                  : "border border-[var(--border)] hover:border-[var(--text-muted)]",
              ].join(" ")}
            >
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="text-[13px] leading-[18px] text-[var(--text)] truncate">
                  {item.label}
                </span>
                <span className="font-mono text-[10px] leading-[12px] text-[var(--text-muted)] truncate">
                  {item.id}
                </span>
              </div>
              <span className="font-mono text-[12px] text-[var(--text-muted)] flex-shrink-0 mt-0.5">
                ${item.cost_usd}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] pt-3 flex items-baseline gap-3 text-[13px]">
        <span className="text-[var(--text-muted)]">
          {selectedDiagnosisIds.length} diagnóstico
          {selectedDiagnosisIds.length === 1 ? "" : "s"} seleccionado
          {selectedDiagnosisIds.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-semibold text-[var(--text)]">
          Total <span className="font-mono">${total}</span>
        </span>
      </div>
    </div>
  );
}
