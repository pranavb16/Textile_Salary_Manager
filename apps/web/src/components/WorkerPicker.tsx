import { X } from "lucide-react";
import type { Employee } from "../types.js";
import { formatMoney } from "../lib/format-money.js";

export function WorkerPicker({ open, employees, onClose, onSelect }: {
  open: boolean;
  employees: Employee[];
  onClose: () => void;
  onSelect: (employee: Employee) => void;
}) {
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="worker-title">
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <span className="eyebrow">UNIT WORKERS</span><h2 id="worker-title">Choose one worker</h2>
      <p className="modal-copy">The list shows active workers assigned to the selected unit.</p>
      <div className="worker-list">{employees.map((employee) => <button key={employee.id} className="worker-option" onClick={() => onSelect(employee)}>
        <span>{employee.name}{employee.employeeCode && <small>{employee.employeeCode}</small>}</span>
        <small>Balance {formatMoney(employee.openingBalance ?? employee.startingAdvanceBalance)}</small>
      </button>)}{!employees.length && <div className="empty-row">No workers added to this unit yet.</div>}</div>
    </section>
  </div>;
}
