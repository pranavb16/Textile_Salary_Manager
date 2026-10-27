import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthShortNames = monthNames.map((name) => name.slice(0, 3));

export function MonthPicker({ value, onChange, minPeriod, maxPeriod, label = "Choose payroll month" }: { value: string; onChange: (value: string) => void; minPeriod?: string; maxPeriod?: string; label?: string }) {
  const [year, month] = value.split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setViewYear(year); }, [year]);
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

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previousYearAllowed = !minPeriod || `${viewYear - 1}-12` >= minPeriod;
  const nextYearAllowed = !maxPeriod || `${viewYear + 1}-01` <= maxPeriod;
  const todayAllowed = (!minPeriod || currentPeriod >= minPeriod) && (!maxPeriod || currentPeriod <= maxPeriod);
  const chooseMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return <div className="month-picker" ref={pickerRef}>
    <button type="button" className="month-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((shown) => !shown)}>
      <span>{monthNames[month - 1]} {year}</span><CalendarDays size={18} aria-hidden="true" />
    </button>
    {open && <div className="month-picker-popover" role="dialog" aria-label={label}>
      <div className="month-picker-header"><button type="button" className="month-year-nav" aria-label="Previous year" disabled={!previousYearAllowed} onClick={() => setViewYear((shown) => shown - 1)}><ChevronLeft size={17} /></button><strong>{viewYear}</strong><button type="button" className="month-year-nav" aria-label="Next year" disabled={!nextYearAllowed} onClick={() => setViewYear((shown) => shown + 1)}><ChevronRight size={17} /></button></div>
      <div className="month-picker-grid">{monthShortNames.map((name, index) => {
        const selected = year === viewYear && month === index + 1;
        const current = now.getFullYear() === viewYear && now.getMonth() === index;
        const optionPeriod = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
        const disabled = Boolean((minPeriod && optionPeriod < minPeriod) || (maxPeriod && optionPeriod > maxPeriod));
        return <button type="button" key={name} className={`month-option${selected ? " selected" : ""}${current ? " current" : ""}`} aria-pressed={selected} disabled={disabled} onClick={() => chooseMonth(index)}>{name}</button>;
      })}</div>
      {todayAllowed && <div className="month-picker-footer"><button type="button" onClick={() => { onChange(currentPeriod); setOpen(false); }}>This month</button></div>}
    </div>}
  </div>;
}
