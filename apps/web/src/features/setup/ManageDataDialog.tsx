import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { UnitPicker } from "../../components/UnitPicker.js";
import type { Unit } from "../../types.js";

export function ManageDataDialog({
  open,
  units,
  unitId,
  unitName,
  unitNameTouched,
  unitNameSubmitted,
  unitNameError,
  employeeName,
  employeeCode,
  employeeStartingBalance,
  employeeNameTouched,
  employeeCodeTouched,
  employeeStartingBalanceTouched,
  employeeSubmitted,
  employeeNameError,
  employeeCodeError,
  employeeStartingBalanceError,
  onClose,
  onUnitChange,
  onUnitNameChange,
  onUnitNameBlur,
  onEmployeeNameChange,
  onEmployeeNameBlur,
  onEmployeeCodeChange,
  onEmployeeCodeBlur,
  onEmployeeStartingBalanceChange,
  onEmployeeStartingBalanceBlur,
  onAddUnit,
  onAddEmployee,
}: {
  open: boolean;
  units: Unit[];
  unitId: string;
  unitName: string;
  unitNameTouched: boolean;
  unitNameSubmitted: boolean;
  unitNameError?: string;
  employeeName: string;
  employeeCode: string;
  employeeStartingBalance: string;
  employeeNameTouched: boolean;
  employeeCodeTouched: boolean;
  employeeStartingBalanceTouched: boolean;
  employeeSubmitted: boolean;
  employeeNameError?: string;
  employeeCodeError?: string;
  employeeStartingBalanceError?: string;
  onClose: (clearError?: boolean) => void;
  onUnitChange: (value: string) => void;
  onUnitNameChange: (value: string) => void;
  onUnitNameBlur: () => void;
  onEmployeeNameChange: (value: string) => void;
  onEmployeeNameBlur: () => void;
  onEmployeeCodeChange: (value: string) => void;
  onEmployeeCodeBlur: () => void;
  onEmployeeStartingBalanceChange: (value: string) => void;
  onEmployeeStartingBalanceBlur: () => void;
  onAddUnit: (event: FormEvent<HTMLFormElement>) => void;
  onAddEmployee: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(true); }}>
    <section className="modal manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-title">
      <button className="icon-button modal-close" onClick={() => onClose(true)} aria-label="Close"><X /></button>
      <span className="eyebrow">BUSINESS SETUP</span><h2 id="manage-title">Manage units &amp; workers</h2>
      <form className="manage-form" onSubmit={onAddUnit} noValidate><h3>Add a manufacturing unit</h3><div className="inline-fields"><div className="setup-field"><input placeholder="Unit name" value={unitName} onChange={(event) => onUnitNameChange(event.target.value)} onBlur={onUnitNameBlur} aria-invalid={Boolean(unitNameError) && (unitNameSubmitted || (unitNameTouched && Boolean(unitName.trim())))} />{unitNameError && (unitNameSubmitted || (unitNameTouched && Boolean(unitName.trim()))) && <small className="field-error">{unitNameError}</small>}</div><button className="button button-primary" type="submit"><Plus size={16} /> Add unit</button></div></form>
      <form className="manage-form" onSubmit={onAddEmployee} noValidate><h3>Add worker to selected unit</h3><div className="setup-field"><label>Manufacturing unit</label><UnitPicker units={units} value={unitId} onChange={onUnitChange} /></div><div className="setup-field"><input placeholder="Worker name" value={employeeName} onChange={(event) => onEmployeeNameChange(event.target.value)} onBlur={onEmployeeNameBlur} aria-invalid={(employeeSubmitted || employeeNameTouched) && Boolean(employeeNameError)} /></div>{(employeeSubmitted || employeeNameTouched) && employeeNameError && <small className="field-error">{employeeNameError}</small>}<div className="setup-field"><label htmlFor="employee-code">Employee code <span>(optional)</span></label><input id="employee-code" placeholder="e.g. EMP-001" value={employeeCode} onChange={(event) => onEmployeeCodeChange(event.target.value)} onBlur={onEmployeeCodeBlur} aria-invalid={(employeeSubmitted || employeeCodeTouched) && Boolean(employeeCodeError)} />{(employeeSubmitted || employeeCodeTouched) && employeeCodeError && <small className="field-error">{employeeCodeError}</small>}</div><div className="setup-field"><label htmlFor="employee-starting-balance">Opening advance balance <span>(optional, defaults to 0)</span></label><input id="employee-starting-balance" type="number" step="1" inputMode="numeric" placeholder="0" value={employeeStartingBalance} onChange={(event) => onEmployeeStartingBalanceChange(event.target.value)} onBlur={onEmployeeStartingBalanceBlur} aria-invalid={(employeeSubmitted || employeeStartingBalanceTouched) && Boolean(employeeStartingBalanceError)} />{(employeeSubmitted || employeeStartingBalanceTouched) && employeeStartingBalanceError && <small className="field-error">{employeeStartingBalanceError}</small>}</div><button className="button button-primary" type="submit" disabled={!unitId}><Plus size={16} /> Add worker</button>{!unitId && <small className="validation-note">Select a unit above or add a new one first.</small>}</form>
    </section>
  </div>;
}
