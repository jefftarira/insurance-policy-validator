"use client";

import type { CatalogItem } from "@/lib/types";

type Props = {
  diagnoses: Record<string, CatalogItem>;
  services: Record<string, CatalogItem>;
  selectedDiagnosisIds: string[];
  selectedServiceIds: string[];
  onToggleDiagnosis: (id: string) => void;
  onToggleService: (id: string) => void;
  disabled?: boolean;
};

export function CatalogSelector({
  diagnoses,
  services,
  selectedDiagnosisIds,
  selectedServiceIds,
  onToggleDiagnosis,
  onToggleService,
  disabled,
}: Props) {
  const diagnosisList = Object.values(diagnoses);
  const serviceList = Object.values(services);
  const diagnosisCost = selectedDiagnosisIds.reduce(
    (acc, id) => acc + (diagnoses[id]?.cost_usd ?? 0),
    0,
  );
  const serviceCost = selectedServiceIds.reduce(
    (acc, id) => acc + (services[id]?.cost_usd ?? 0),
    0,
  );
  const total = diagnosisCost + serviceCost;
  const totalSelected = selectedDiagnosisIds.length + selectedServiceIds.length;

  return (
    <div className="flex flex-col gap-4">
      <Section
        label="Diagnósticos"
        sublabel="Al menos uno requerido"
        items={diagnosisList}
        selectedIds={selectedDiagnosisIds}
        onToggle={onToggleDiagnosis}
        disabled={disabled}
      />
      <Section
        label="Servicios y procedimientos"
        sublabel="Opcional"
        items={serviceList}
        selectedIds={selectedServiceIds}
        onToggle={onToggleService}
        disabled={disabled}
      />

      <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
        <span className="text-[var(--text-muted)]">
          {selectedDiagnosisIds.length} diagnóstico
          {selectedDiagnosisIds.length === 1 ? "" : "s"}{" "}
          <span className="font-mono text-[var(--text)]">${diagnosisCost}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          {selectedServiceIds.length} servicio
          {selectedServiceIds.length === 1 ? "" : "s"}{" "}
          <span className="font-mono text-[var(--text)]">${serviceCost}</span>
        </span>
        <span className="ml-auto font-semibold text-[var(--text)]">
          Total ({totalSelected}){" "}
          <span className="font-mono">${total}</span>
        </span>
      </div>
    </div>
  );
}

function Section({
  label,
  sublabel,
  items,
  selectedIds,
  onToggle,
  disabled,
}: {
  label: string;
  sublabel: string;
  items: CatalogItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text)]">
          {label}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">{sublabel}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onToggle(item.id)}
              className={[
                "flex items-center justify-between gap-3 text-left",
                "bg-[var(--surface)] rounded-md px-3 py-2.5",
                "transition-[border-color,background] duration-150",
                "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                selected
                  ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-[11px] py-[9px]"
                  : "border border-[var(--border)] hover:border-[var(--text-muted)]",
              ].join(" ")}
            >
              <span className="text-[13px] leading-[18px] text-[var(--text)] truncate">
                {item.label}
              </span>
              <span className="font-mono text-[12px] text-[var(--text-muted)] flex-shrink-0">
                ${item.cost_usd}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
