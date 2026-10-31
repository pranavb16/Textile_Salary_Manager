import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, LogOut, UsersRound } from "lucide-react";
import { createEmployeeSchema, createUnitSchema, payrollFormSchema } from "@salary/contracts";
import { createEmployee, createUnit, getEmployees, getPayrollRecords, getUnits, savePayrollRecord } from "../api/index.js";
import { MonthPicker } from "../components/MonthPicker.js";
import { UnitPicker } from "../components/UnitPicker.js";
import { WorkerPicker } from "../components/WorkerPicker.js";
import { ManageDataDialog } from "../features/setup/ManageDataDialog.js";
import { PayrollEntryForm } from "../features/payroll/PayrollEntryForm.js";
import { PayrollReport } from "../features/payroll/PayrollReport.js";
import { AnnualReportPage } from "../features/annual/AnnualReportPage.js";
import { formatMoney, money } from "../lib/format-money.js";
import type { FieldErrors, Form, FormField, RecordRow, Employee, Unit } from "../types.js";

const currentDate = new Date();
const monthNow = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
const emptyForm: Form = { employeeId: "", isMender: false, mendingMetres: "", mendingRate: "", totalDays: "", shift8Days: "", shift12Days: "", shift8Rate: "", shift12Rate: "", cashPaid: "", bankPaid: "", advanceRequested: "0" };
const messageDismissDelay = 5000;

const dayTotalValidationMessage = "Shift days must be equal to total days.";

function menderSalary(metres: string, rate: string) {
  function hundredths(value: string) {
    if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return 0n;
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  }
  return Number((hundredths(metres) * hundredths(rate) + 5000n) / 10000n) / 100;
}

function payrollErrors(form: Form, period: string, showDayTotalMismatch: boolean): FieldErrors {
  const result = payrollFormSchema.safeParse({ ...form, period });
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    if (!showDayTotalMismatch && issue.path[0] === "totalDays" && issue.message === dayTotalValidationMessage) continue;
    const field = issue.path[0] as FormField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export default function PayrollApp({ username, onSignOut, signOutError }: { username: string; onSignOut: () => Promise<void>; signOutError: string }) {
  const [page, setPage] = useState<"monthly" | "annual">(window.location.hash === "#/annual-report" ? "annual" : "monthly");
  const [units, setUnits] = useState<Unit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [unitId, setUnitId] = useState("");
  const [period, setPeriod] = useState(monthNow);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [chooseWorker, setChooseWorker] = useState(false);
  const [manageData, setManageData] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [unitNameTouched, setUnitNameTouched] = useState(false);
  const [unitNameSubmitted, setUnitNameSubmitted] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeStartingBalance, setEmployeeStartingBalance] = useState("");
  const [employeeNameTouched, setEmployeeNameTouched] = useState(false);
  const [employeeCodeTouched, setEmployeeCodeTouched] = useState(false);
  const [employeeStartingBalanceTouched, setEmployeeStartingBalanceTouched] = useState(false);
  const [employeeSubmitted, setEmployeeSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const showDayTotalMismatch = submitted || Boolean(touched.shift8Days || touched.shift12Days);
  const fieldErrors = payrollErrors(form, period, showDayTotalMismatch);
  const daysAreWhole = /^\d+$/.test(form.totalDays) && (form.shift8Days === "" || /^\d+$/.test(form.shift8Days)) && (form.shift12Days === "" || /^\d+$/.test(form.shift12Days));
  const dayTotalMismatch = daysAreWhole && showDayTotalMismatch && Number(form.shift8Days || 0) + Number(form.shift12Days || 0) !== Number(form.totalDays);
  const totalDaysError = dayTotalMismatch ? dayTotalValidationMessage : fieldErrors.totalDays;
  const unitNameValidation = createUnitSchema.shape.name.safeParse(unitName);
  const unitNameError = unitNameValidation.success ? undefined : unitNameValidation.error.issues[0]?.message;
  const employeeNameValidation = createEmployeeSchema.shape.name.safeParse(employeeName);
  const employeeNameError = employeeNameValidation.success ? undefined : employeeNameValidation.error.issues[0]?.message;
  const employeeCodeValidation = createEmployeeSchema.shape.employeeCode.safeParse(employeeCode);
  const employeeCodeError = employeeCodeValidation.success ? undefined : employeeCodeValidation.error.issues[0]?.message;
  const employeeStartingBalanceValidation = createEmployeeSchema.shape.startingAdvanceBalance.safeParse(employeeStartingBalance || undefined);
  const employeeStartingBalanceError = employeeStartingBalanceValidation.success ? undefined : employeeStartingBalanceValidation.error.issues[0]?.message;

  const reload = useCallback(async () => {
    try {
      const loadedUnits = await getUnits();
      setUnits(loadedUnits);
      if (!unitId) { setEmployees([]); setRecords([]); return; }
      const [staff, payroll] = await Promise.all([
        getEmployees(unitId, period),
        getPayrollRecords(unitId, period),
      ]);
      setEmployees(staff);
      setRecords(payroll);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the payroll data."); }
  }, [unitId, period]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash === "#/annual-report" ? "annual" : "monthly");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), messageDismissDelay);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), messageDismissDelay);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const selectedEmployee = employees.find((employee) => String(employee.id) === form.employeeId);
  const openingBalance = editingId
    ? records.find((record) => record.id === editingId)?.openingBalance ?? selectedEmployee?.openingBalance ?? "0"
    : selectedEmployee?.openingBalance ?? selectedEmployee?.startingAdvanceBalance ?? "0";
  const earned = useMemo(() => form.isMender ? menderSalary(form.mendingMetres, form.mendingRate) : money(form.shift8Days) * money(form.shift8Rate) + money(form.shift12Days) * money(form.shift12Rate), [form]);
  const payoutTotal = money(form.cashPaid) + money(form.bankPaid);
  const availablePayout = earned + Math.max(0, -money(openingBalance));
  const payoutError = payoutTotal > availablePayout ? "Cash and bank exceed available salary." : undefined;
  const saveDisabled = saving || !payrollFormSchema.safeParse({ ...form, period }).success || Boolean(payoutError);
  const unpaidSalary = Math.max(0, earned - payoutTotal);
  const closingBalance = money(openingBalance) + money(form.advanceRequested) - (earned - money(form.cashPaid) - money(form.bankPaid));

  function set<K extends FormField>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  }
  function blurField(key: FormField) { setTouched((current) => ({ ...current, [key]: true })); }
  function resetForm() { setForm(emptyForm); setEditingId(null); setTouched({}); setSubmitted(false); }
  function closeManageDialog(clearError = false) {
    setManageData(false);
    setUnitNameTouched(false); setUnitNameSubmitted(false);
    setEmployeeNameTouched(false); setEmployeeCodeTouched(false); setEmployeeStartingBalanceTouched(false); setEmployeeSubmitted(false);
    if (clearError) setError("");
  }

  async function savePayroll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitted(true);
    const result = payrollFormSchema.safeParse({ ...form, period });
    if (!result.success || payoutError) return;
    setSaving(true);
    try {
      await savePayrollRecord(editingId, result.data);
      resetForm(); await reload(); setNotice("Payroll saved. This worker’s later balances were recalculated.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save payroll."); }
    finally { setSaving(false); }
  }

  async function addUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setUnitNameSubmitted(true);
    const result = createUnitSchema.safeParse({ name: unitName });
    if (!result.success) return;
    try {
      const createdUnit = await createUnit(result.data);
      setUnitName(""); setUnitNameTouched(false); setUnitNameSubmitted(false);
      setUnitId(String(createdUnit.id));
      await reload(); setNotice("Unit added. You can now add workers to it.");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the unit."); closeManageDialog(); }
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setEmployeeSubmitted(true);
    setUnitNameTouched(false); setUnitNameSubmitted(false);
    const result = createEmployeeSchema.safeParse({
      name: employeeName,
      employeeCode: employeeCode || null,
      unitId: Number(unitId),
      ...(employeeStartingBalance ? { startingAdvanceBalance: employeeStartingBalance } : {}),
    });
    if (!result.success) return;
    try { await createEmployee(result.data); setEmployeeName(""); setEmployeeCode(""); setEmployeeStartingBalance(""); await reload(); setNotice("Worker added to this unit."); closeManageDialog(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the worker."); closeManageDialog(); }
  }

  function editPayroll(row: RecordRow) {
    setEditingId(row.id);
    setForm({ employeeId: String(row.employeeId), isMender: row.isMender, mendingMetres: row.mendingMetres ?? "", mendingRate: row.mendingRate ?? "", totalDays: String(row.totalDays), shift8Days: String(row.shift8Days), shift12Days: String(row.shift12Days), shift8Rate: row.shift8Rate, shift12Rate: row.shift12Rate, cashPaid: row.cashPaid, bankPaid: row.bankPaid, advanceRequested: row.advanceRequested });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const reportTitle = `${new Date(`${period}-02T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · ${units.find((unit) => String(unit.id) === unitId)?.name}`;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon"><Building2 size={21} /></span><div><strong>Textile Salary Manager</strong><small>Monthly payroll · Manufacturing units</small></div></div><div className="account-actions"><span>{username}</span><button className="button button-outline" type="button" onClick={() => void onSignOut()}><LogOut size={16} /> Sign out</button></div></header>
    {signOutError && <div className="alert alert-error sign-out-error" role="alert">{signOutError}</div>}
    <nav className="page-tabs" aria-label="Reports and payroll"><a href="#/monthly-payroll" className={page === "monthly" ? "page-tab active" : "page-tab"} aria-current={page === "monthly" ? "page" : undefined}>Monthly Payroll</a><a href="#/annual-report" className={page === "annual" ? "page-tab active" : "page-tab"} aria-current={page === "annual" ? "page" : undefined}>Annual Salary Report</a></nav>
    {page === "annual" ? <AnnualReportPage units={units} /> : <div className="page-wrap">
      <section className="filters panel"><div className="filter-field"><span>Payroll month</span><MonthPicker value={period} onChange={(value) => { setPeriod(value); resetForm(); }} /></div><div className="filter-field"><span>Manufacturing unit</span><UnitPicker units={units} value={unitId} onChange={(value) => { setUnitId(value); resetForm(); }} /></div><button className="button button-outline new-entry" onClick={() => setManageData(true)}><UsersRound size={17} /> Manage units &amp; workers</button></section>
      {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="workspace">
        <PayrollEntryForm
          unitSelected={Boolean(unitId)}
          selectedEmployeeName={selectedEmployee?.name}
          form={form}
          editingId={editingId}
          saving={saving}
          saveDisabled={saveDisabled}
          submitted={submitted}
          touched={touched}
          fieldErrors={fieldErrors}
          totalDaysError={totalDaysError}
          payoutError={payoutError}
          earned={earned}
          openingBalance={openingBalance}
          payoutTotal={payoutTotal}
          unpaidSalary={unpaidSalary}
          closingBalance={closingBalance}
          onSubmit={savePayroll}
          onSelectWorker={() => setChooseWorker(true)}
          onMenderChange={(isMender) => setForm((current) => ({ ...current, isMender }))}
          onFieldChange={(key, value) => set(key, value)}
          onFieldBlur={blurField}
          onCancelEdit={resetForm}
          formatMoney={formatMoney}
        />
        <PayrollReport unitSelected={Boolean(unitId)} title={reportTitle} records={records} onPrint={() => window.print()} onEdit={editPayroll} />
      </div>
    </div>}
    <WorkerPicker open={chooseWorker} employees={employees} onClose={() => setChooseWorker(false)} onSelect={(employee) => { set("employeeId", String(employee.id)); setChooseWorker(false); }} />
    <ManageDataDialog
      open={manageData}
      units={units}
      unitId={unitId}
      unitName={unitName}
      unitNameTouched={unitNameTouched}
      unitNameSubmitted={unitNameSubmitted}
      unitNameError={unitNameError}
      employeeName={employeeName}
      employeeCode={employeeCode}
      employeeStartingBalance={employeeStartingBalance}
      employeeNameTouched={employeeNameTouched}
      employeeCodeTouched={employeeCodeTouched}
      employeeStartingBalanceTouched={employeeStartingBalanceTouched}
      employeeSubmitted={employeeSubmitted}
      employeeNameError={employeeNameError}
      employeeCodeError={employeeCodeError}
      employeeStartingBalanceError={employeeStartingBalanceError}
      onClose={closeManageDialog}
      onUnitChange={(value) => { setUnitId(value); resetForm(); }}
      onUnitNameChange={setUnitName}
      onUnitNameBlur={() => setUnitNameTouched(true)}
      onEmployeeNameChange={setEmployeeName}
      onEmployeeNameBlur={() => setEmployeeNameTouched(true)}
      onEmployeeCodeChange={setEmployeeCode}
      onEmployeeCodeBlur={() => setEmployeeCodeTouched(true)}
      onEmployeeStartingBalanceChange={setEmployeeStartingBalance}
      onEmployeeStartingBalanceBlur={() => setEmployeeStartingBalanceTouched(true)}
      onAddUnit={addUnit}
      onAddEmployee={addEmployee}
    />
  </main>;
}
