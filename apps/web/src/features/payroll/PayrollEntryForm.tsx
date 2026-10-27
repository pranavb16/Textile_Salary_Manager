import type { FormEvent } from "react";
import { UsersRound, WalletCards } from "lucide-react";
import { MoneyInput } from "../../components/MoneyInput.js";
import { Summary } from "../../components/Summary.js";
import type { FieldErrors, Form, FormField } from "../../types.js";

export function PayrollEntryForm({
  unitSelected,
  selectedEmployeeName,
  form,
  editingId,
  saving,
  saveDisabled,
  submitted,
  touched,
  fieldErrors,
  totalDaysError,
  payoutError,
  earned,
  openingBalance,
  payoutTotal,
  unpaidSalary,
  closingBalance,
  onSubmit,
  onSelectWorker,
  onFieldChange,
  onFieldBlur,
  onCancelEdit,
  formatMoney,
}: {
  unitSelected: boolean;
  selectedEmployeeName?: string;
  form: Form;
  editingId: number | null;
  saving: boolean;
  saveDisabled: boolean;
  submitted: boolean;
  touched: Partial<Record<FormField, boolean>>;
  fieldErrors: FieldErrors;
  totalDaysError?: string;
  payoutError?: string;
  earned: number;
  openingBalance: string;
  payoutTotal: number;
  unpaidSalary: number;
  closingBalance: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectWorker: () => void;
  onFieldChange: (key: FormField, value: string) => void;
  onFieldBlur: (key: FormField) => void;
  onCancelEdit: () => void;
  formatMoney: (value: string | number) => string;
}) {
  return <section className="panel entry-panel"><div className="section-heading"><h1>Worker payroll entry</h1></div>
    {!unitSelected ? <div className="empty-hint">Choose a month and unit to start entering payroll.</div> : <form onSubmit={onSubmit} className="entry-form" noValidate>
      <label>Worker<button type="button" className="worker-select" onClick={onSelectWorker}>{selectedEmployeeName || "Select one worker"}<UsersRound size={17} /></button><small className={`field-error${(submitted || touched.employeeId) && fieldErrors.employeeId ? "" : " field-error-empty"}`} aria-live="polite">{(submitted || touched.employeeId) ? fieldErrors.employeeId ?? "\u00a0" : "\u00a0"}</small></label>
      <div className="field-grid days-grid">
        <MoneyInput label="Total working days" value={form.totalDays} onChange={(value) => onFieldChange("totalDays", value)} onBlur={() => onFieldBlur("totalDays")} error={(submitted || touched.totalDays || touched.shift8Days || touched.shift12Days) ? totalDaysError : undefined} whole min={1} />
        <MoneyInput label="8-hour days" value={form.shift8Days} onChange={(value) => onFieldChange("shift8Days", value)} onBlur={() => onFieldBlur("shift8Days")} error={(submitted || touched.shift8Days) ? fieldErrors.shift8Days : undefined} whole min={0} required={false} />
        <MoneyInput label="12-hour days" value={form.shift12Days} onChange={(value) => onFieldChange("shift12Days", value)} onBlur={() => onFieldBlur("shift12Days")} error={(submitted || touched.shift12Days) ? fieldErrors.shift12Days : undefined} whole min={0} required={false} />
      </div>
      <div className="field-grid">
        <MoneyInput label="Pay per 8-hour shift" value={form.shift8Rate} onChange={(value) => onFieldChange("shift8Rate", value)} onBlur={() => onFieldBlur("shift8Rate")} error={(submitted || touched.shift8Rate) ? fieldErrors.shift8Rate : undefined} required={false} />
        <MoneyInput label="Pay per 12-hour shift" value={form.shift12Rate} onChange={(value) => onFieldChange("shift12Rate", value)} onBlur={() => onFieldBlur("shift12Rate")} error={(submitted || touched.shift12Rate) ? fieldErrors.shift12Rate : undefined} required={false} />
      </div>
      <div className={`field-grid advance-payout-fields${(submitted || touched.cashPaid || touched.bankPaid) && payoutError ? " has-error" : ""}`}>
        <MoneyInput label="New Advance Issued" value={form.advanceRequested} onChange={(value) => onFieldChange("advanceRequested", value)} onBlur={() => onFieldBlur("advanceRequested")} error={(submitted || touched.advanceRequested) ? fieldErrors.advanceRequested : undefined} />
        <MoneyInput label="Cash payout" value={form.cashPaid} onChange={(value) => onFieldChange("cashPaid", value)} onBlur={() => onFieldBlur("cashPaid")} error={(submitted || touched.cashPaid) ? fieldErrors.cashPaid : undefined} />
      </div>
      <div className={`field-grid payout-summary-row${(submitted || touched.cashPaid || touched.bankPaid) && payoutError ? " has-error" : ""}`}>
        <div className="totals-box">
          <Summary label="Salary earned" value={formatMoney(earned)} />
          <Summary label="Opening advance" value={formatMoney(openingBalance)} />
          <Summary label="Cash + bank" value={formatMoney(payoutTotal)} />
          <Summary label="Unpaid salary" value={formatMoney(unpaidSalary)} />
          <Summary label="Closing advance" value={formatMoney(closingBalance)} />
        </div>
        <div className="bank-payout-cell">
          <MoneyInput label="Bank payout" value={form.bankPaid} onChange={(value) => onFieldChange("bankPaid", value)} onBlur={() => onFieldBlur("bankPaid")} error={(submitted || touched.bankPaid) ? fieldErrors.bankPaid : undefined} />
          <small className={`field-error payout-error${(submitted || touched.cashPaid || touched.bankPaid) && payoutError ? "" : " field-error-empty"}`} aria-live="polite">{(submitted || touched.cashPaid || touched.bankPaid) ? payoutError ?? "\u00a0" : "\u00a0"}</small>
        </div>
      </div>
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={saveDisabled}>{saving ? "Saving…" : editingId ? "Update payroll" : "Save payroll"}<WalletCards size={17} /></button>{editingId && <button type="button" className="button button-quiet" onClick={onCancelEdit}>Cancel edit</button>}</div>
    </form>}
  </section>;
}
