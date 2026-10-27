export function MoneyInput({ label, value, onChange, onBlur, error, whole = false, min = 0, required = true }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  whole?: boolean;
  min?: number;
  required?: boolean;
}) {
  return <label className="money-field">{label}<input type="number" min={min} step={1} inputMode={whole ? "numeric" : "decimal"} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} required={required} /><small className={`field-error${error ? "" : " field-error-empty"}`} aria-live="polite">{error ?? "\u00a0"}</small></label>;
}
