import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Unit } from "../types.js";

export function UnitPicker({ units, value, onChange }: { units: Unit[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedUnit = units.find((unit) => String(unit.id) === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="unit-picker" ref={pickerRef}>
    <button type="button" className="unit-picker-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((shown) => !shown)}>
      <span>{selectedUnit?.name ?? "Select unit"}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div className="unit-picker-popover" role="listbox" aria-label="Manufacturing unit">
      <button type="button" className={`unit-option${!value ? " selected" : ""}`} role="option" aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }}>Select unit</button>
      {units.map((unit) => {
        const selected = String(unit.id) === value;
        return <button type="button" key={unit.id} className={`unit-option${selected ? " selected" : ""}`} role="option" aria-selected={selected} onClick={() => { onChange(String(unit.id)); setOpen(false); }}>{unit.name}</button>;
      })}
    </div>}
  </div>;
}
