"use client";

import { useState } from "react";

type Props = {
  admissionsEmail: string;
  caseManagerEmail: string;
  onAdmissionsChange: (v: string) => void;
  onCaseManagerChange: (v: string) => void;
  disabled?: boolean;
};

function validEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function EmailInputs({
  admissionsEmail,
  caseManagerEmail,
  onAdmissionsChange,
  onCaseManagerChange,
  disabled,
}: Props) {
  const [touched, setTouched] = useState({ adm: false, cm: false });

  const admError =
    touched.adm && admissionsEmail.length > 0 && !validEmail(admissionsEmail)
      ? "Email no válido"
      : "";
  const cmError =
    touched.cm && caseManagerEmail.length > 0 && !validEmail(caseManagerEmail)
      ? "Email no válido"
      : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field
        id="email-admissions"
        label="Admisiones del hospital"
        hint="Recibirá la confirmación de cobertura para proceder con el ingreso."
        placeholder="admisiones@hospital.demo"
        value={admissionsEmail}
        onChange={onAdmissionsChange}
        onBlur={() => setTouched((s) => ({ ...s, adm: true }))}
        error={admError}
        disabled={disabled}
      />
      <Field
        id="email-case-manager"
        label="Gestor de casos del seguro"
        hint="Recibirá el caso para seguimiento y validación posterior."
        placeholder="gestor@aseguradora.demo"
        value={caseManagerEmail}
        onChange={onCaseManagerChange}
        onBlur={() => setTouched((s) => ({ ...s, cm: true }))}
        error={cmError}
        disabled={disabled}
      />
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string;
  disabled?: boolean;
};

function Field({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[14px] font-semibold text-[var(--text)]"
      >
        {label}
      </label>
      <p className="text-[13px] leading-[18px] text-[var(--text-muted)] mb-1.5">{hint}</p>
      <input
        id={id}
        type="email"
        autoComplete="email"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        className={[
          "bg-[var(--surface)] text-[var(--text)] text-[15px]",
          "rounded-md px-3.5 py-3 transition-[border-color] duration-150",
          "focus:outline-none focus:border-[var(--accent)] focus:border-2 focus:px-[13px] focus:py-[11px]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          error
            ? "border border-[var(--alert)]"
            : "border border-[var(--border)]",
        ].join(" ")}
      />
      <span
        id={errorId}
        role="alert"
        aria-live="polite"
        className="text-[12px] text-[var(--alert)] min-h-[16px]"
      >
        {error}
      </span>
    </div>
  );
}
