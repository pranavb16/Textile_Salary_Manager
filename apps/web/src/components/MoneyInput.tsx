export function MoneyInput({ label, value, onChange, onBlur, error, whole = false, min = 0, required = true, step = 1, positive = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  whole?: boolean;
  min?: number;
  required?: boolean;
  step?: number;
  positive?: boolean;
}) {
  return <label className="money-field">{label}<input type="number" min={min} step={step} inputMode={whole ? "numeric" : "decimal"} value={value} onChange={(event) => { if (!positive || !event.target.value.startsWith("-")) onChange(event.target.value); }} onKeyDown={positive ? (event) => { if (!event.ctrlKey && !event.metaKey && ["-", "+", "e", "E"].includes(event.key)) event.preventDefault(); } : undefined} onBlur={onBlur} aria-invalid={Boolean(error)} required={required} /><small className={`field-error${error ? "" : " field-error-empty"}`} aria-live="polite">{error ?? "\u00a0"}</small></label>;
}
