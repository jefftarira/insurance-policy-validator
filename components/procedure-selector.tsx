"use client";

import type { Procedure } from "@/lib/types";

type Props = {
  procedures: Record<string, Procedure>;
  selectedIds: string[];
  baseAdmissionCost: number;
  onToggle: (id: string) => void;
  disabled?: boolean;
};

export function ProcedureSelector({
  procedures,
  selectedIds,
  baseAdmissionCost,
  onToggle,
  disabled,
}: Props) {
  const ordered = Object.values(procedures);
  const extras = selectedIds.reduce((acc, id) => acc + (procedures[id]?.cost_usd ?? 0), 0);
  const total = baseAdmissionCost + extras;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
        {ordered.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onToggle(p.id)}
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
                {p.label}
              </span>
              <span className="font-mono text-[12px] text-[var(--text-muted)] flex-shrink-0">
                ${p.cost_usd}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
        <span className="text-[var(--text-muted)]">
          Base ingreso{" "}
          <span className="font-mono text-[var(--text)]">${baseAdmissionCost}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          + Procedimientos{" "}
          <span className="font-mono text-[var(--text)]">${extras}</span>
        </span>
        <span className="ml-auto font-semibold text-[var(--text)]">
          Total{" "}
          <span className="font-mono">${total}</span>
        </span>
      </div>
    </div>
  );
}
