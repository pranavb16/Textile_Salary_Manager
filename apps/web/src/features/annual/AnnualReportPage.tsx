import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { annualBonusRateSchema, annualLeaveSaveSchema } from "@salary/contracts";
import { getAnnualLeaveData, getAnnualOptions, getAnnualReport, saveAnnualLeaveData } from "../../api/index.js";
import { MonthPicker } from "../../components/MonthPicker.js";
import { UnitPicker } from "../../components/UnitPicker.js";
import { formatMoney } from "../../lib/format-money.js";
import type { AnnualLeaveData, AnnualOptions, AnnualReportData, Unit } from "../../types.js";

function displayMonth(period: string) {
  return new Date(`${period}-01T00:00:00.000Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function AnnualReportPage({ units }: { units: Unit[] }) {
  const [unitId, setUnitId] = useState("");
  const [bonusRate, setBonusRate] = useState("");
  const [menderBonusRate, setMenderBonusRate] = useState("");
  const [startPeriod, setStartPeriod] = useState("");
  const [options, setOptions] = useState<AnnualOptions | null>(null);
  const [leaveData, setLeaveData] = useState<AnnualLeaveData | null>(null);
  const [form, setForm] = useState<Record<number, { totalLeaves: string; perDaySalary: string }>>({});
  const [showLeave, setShowLeave] = useState(false);
  const [report, setReport] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bonusRateTouched, setBonusRateTouched] = useState(false);
  const [menderBonusRateTouched, setMenderBonusRateTouched] = useState(false);
  const selection = useRef("");
  selection.current = `${unitId}|${startPeriod}|${bonusRate}|${menderBonusRate}`;

  useEffect(() => {
    if (!unitId) { setOptions(null); setStartPeriod(""); return; }
    let active = true;
    setLoading(true); setOptions(null); setStartPeriod(""); setLeaveData(null); setReport(null); setShowLeave(false); setError("");
    void getAnnualOptions(unitId).then((result) => {
      if (!active) return;
      setOptions(result);
      setStartPeriod(result.earliestPeriod ?? "");
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load report months."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [unitId]);

  useEffect(() => {
    if (!unitId || !startPeriod) { setLeaveData(null); return; }
    let active = true;
    setLeaveData(null); setReport(null); setShowLeave(false); setError(""); setNotice("");
    void getAnnualLeaveData(unitId, startPeriod).then((data) => {
      if (!active) return;
      setLeaveData(data);
      setForm(Object.fromEntries(data.workers.map((worker) => [worker.employeeId, { totalLeaves: String(worker.totalLeaves), perDaySalary: worker.perDaySalary }])));
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load workers."); });
    return () => { active = false; };
  }, [unitId, startPeriod]);

  const allSaved = Boolean(leaveData?.workers.length && leaveData.workers.every((worker) => worker.saved
    && form[worker.employeeId]?.totalLeaves === String(worker.totalLeaves)
    && form[worker.employeeId]?.perDaySalary === worker.perDaySalary));
  const bonusRateValid = Boolean(unitId && annualBonusRateSchema.safeParse(bonusRate).success);
  const menderBonusRateValid = Boolean(unitId && annualBonusRateSchema.safeParse(menderBonusRate).success);
  const showBonusRateError = bonusRateTouched && !bonusRateValid;
  const showMenderBonusRateError = menderBonusRateTouched && !menderBonusRateValid;

  function updateBonusRate(value: string, forMender = false) {
    selection.current = `${unitId}|${startPeriod}|${forMender ? bonusRate : value}|${forMender ? value : menderBonusRate}`;
    if (forMender) setMenderBonusRate(value);
    else setBonusRate(value);
    setReport(null);
  }

  function updateWorker(employeeId: number, field: "totalLeaves" | "perDaySalary", value: string) {
    setForm((current) => ({ ...current, [employeeId]: { ...current[employeeId], [field]: value } }));
    setReport(null); setNotice("");
  }

  async function saveData() {
    if (!leaveData) return;
    const requestSelection = selection.current;
    const input = annualLeaveSaveSchema.safeParse({ endPeriod: leaveData.endPeriod, workers: leaveData.workers.map((worker) => ({
      employeeId: worker.employeeId,
      recordCount: worker.recordCount,
      totalLeaves: form[worker.employeeId]?.totalLeaves === "" ? Number.NaN : Number(form[worker.employeeId]?.totalLeaves),
      perDaySalary: form[worker.employeeId]?.perDaySalary ?? "",
    })) });
    if (!input.success) { setError(input.error.issues[0]?.message ?? "Check leave salary inputs."); return; }
    setSaving(true); setError(""); setNotice(""); setReport(null);
    try {
      const data = await saveAnnualLeaveData(unitId, startPeriod, input.data);
      if (requestSelection !== selection.current) return;
      setLeaveData(data);
      setForm(Object.fromEntries(data.workers.map((worker) => [worker.employeeId, { totalLeaves: String(worker.totalLeaves), perDaySalary: worker.perDaySalary }])));
      setNotice("Leave salary saved. You can now generate the annual report.");
    } catch (cause) { if (requestSelection === selection.current) setError(cause instanceof Error ? cause.message : "Could not save leave salary."); }
    finally { setSaving(false); }
  }

  async function generateReport() {
    const requestSelection = selection.current;
    setGenerating(true); setError(""); setNotice(""); setReport(null);
    try { const data = await getAnnualReport(unitId, startPeriod, bonusRate, menderBonusRate); if (requestSelection === selection.current) setReport(data); }
    catch (cause) { if (requestSelection === selection.current) setError(cause instanceof Error ? cause.message : "Could not generate the report."); }
    finally { setGenerating(false); }
  }

  return <div className="page-wrap annual-page">
    <div className="section-heading annual-page-heading"><span className="eyebrow">REPORTS</span><h1>Annual Salary Report</h1><p>Calculate leave salary, then generate the bonus report for your selected unit and period.</p></div>
    <section className="filters panel annual-filters" aria-label="Annual report selections">
      <div className="filter-field"><span>Manufacturing unit</span><UnitPicker units={units} value={unitId} onChange={(value) => { setUnitId(value); setBonusRate(""); setMenderBonusRate(""); setBonusRateTouched(false); setMenderBonusRateTouched(false); setReport(null); }} /></div>
      <div className="filter-field"><span>From which month do you want the salary report?</span>{startPeriod && options?.earliestPeriod && options.latestPeriod
        ? <MonthPicker value={startPeriod} minPeriod={options.earliestPeriod} maxPeriod={options.latestPeriod} label="Choose report start month" onChange={setStartPeriod} />
        : <div className="annual-placeholder">{loading ? "Loading months…" : "Select a unit first"}</div>}</div>
      <div className="filter-field"><label htmlFor="annual-bonus-rate">Bonus rate (%)</label><input id="annual-bonus-rate" className="annual-bonus-rate-input" type="number" min="0.01" max="100" step="0.01" value={bonusRate} disabled={!unitId} onChange={(event) => { setBonusRateTouched(true); updateBonusRate(event.target.value); }} onBlur={() => setBonusRateTouched(true)} aria-invalid={showBonusRateError} aria-describedby="annual-bonus-rate-help" /><small id="annual-bonus-rate-help" className={showBonusRateError ? "annual-rate-help invalid" : "annual-rate-help"}>{!unitId ? "Select a unit first." : bonusRateValid ? "Applied to workers whose names do not end in Mender." : "Enter a positive rate up to 100%, with up to two decimal places."}</small></div>
      <div className="filter-field"><label htmlFor="annual-mender-bonus-rate">Mender bonus rate (%)</label><input id="annual-mender-bonus-rate" className="annual-bonus-rate-input" type="number" min="0.01" max="100" step="0.01" value={menderBonusRate} disabled={!unitId} onChange={(event) => { setMenderBonusRateTouched(true); updateBonusRate(event.target.value, true); }} onBlur={() => setMenderBonusRateTouched(true)} aria-invalid={showMenderBonusRateError} aria-describedby="annual-mender-bonus-rate-help" /><small id="annual-mender-bonus-rate-help" className={showMenderBonusRateError ? "annual-rate-help invalid" : "annual-rate-help"}>{!unitId ? "Select a unit first." : menderBonusRateValid ? "Applied to workers whose names end in Mender." : "Enter a positive rate up to 100%, with up to two decimal places."}</small></div>
      <div className="annual-actions"><button type="button" className="button button-outline" disabled={!leaveData?.workers.length} onClick={() => setShowLeave(true)}>Calculate Leave Salary</button><button type="button" className="button button-primary" disabled={!allSaved || !bonusRateValid || !menderBonusRateValid || saving || generating} onClick={() => void generateReport()}>{generating ? "Generating…" : "Generate Report"}</button></div>
    </section>
    {options?.latestPeriod && <p className="annual-range-hint">Latest payroll: {displayMonth(options.latestPeriod)} · Available starts: {displayMonth(options.earliestPeriod!)} to {displayMonth(options.latestPeriod)}</p>}
    {options && !options.latestPeriod && <div className="empty-hint">This unit has no payroll records yet.</div>}
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {leaveData && !leaveData.workers.length && <div className="empty-hint">No workers have payroll records in this period.</div>}
    {leaveData && leaveData.workers.length > 0 && !allSaved && !showLeave && <div className="empty-hint">Calculate and save leave salary to enable the annual report.</div>}

    {showLeave && leaveData && <section className="panel annual-leave-panel" aria-labelledby="annual-leave-title">
      <div className="section-heading"><span className="eyebrow">LEAVE SALARY</span><h2 id="annual-leave-title">Calculate Leave Salary</h2><p>{displayMonth(leaveData.startPeriod)} to {displayMonth(leaveData.endPeriod)} · {leaveData.unit.name}</p></div>
      <div className="annual-leave-list">{leaveData.workers.map((worker) => <div className="annual-leave-row" key={worker.employeeId}>
        <div className="annual-worker"><strong>{worker.name}</strong>{worker.employeeCode && <small>{worker.employeeCode}</small>}<small>{worker.recordCount} payroll record{worker.recordCount === 1 ? "" : "s"}</small></div>
        <label>Total leaves<input type="number" min="0" max="365" step="1" inputMode="numeric" value={form[worker.employeeId]?.totalLeaves ?? ""} onChange={(event) => updateWorker(worker.employeeId, "totalLeaves", event.target.value)} /></label>
        <label>Per-day salary<input type="number" min="0" step="1" inputMode="numeric" value={form[worker.employeeId]?.perDaySalary ?? ""} onChange={(event) => updateWorker(worker.employeeId, "perDaySalary", event.target.value)} /></label>
      </div>)}</div>
      <div className="annual-save-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => void saveData()}>{saving ? "Saving…" : "Save Data"}</button></div>
    </section>}

    {report && <section className="report-section annual-report-section" aria-labelledby="annual-report-title">
      <h2 id="annual-report-title" className="report-section-title">Annual report</h2>
      <div className="panel report-panel"><div className="report-head"><div><h2>Annual Salary Report · {report.unit.name}</h2><p>{displayMonth(report.startPeriod)} to {displayMonth(report.endPeriod)} · {report.rows.length} worker{report.rows.length === 1 ? "" : "s"}</p></div><button type="button" className="button button-outline" onClick={() => window.print()}><FileDown size={17} /> Print / Save PDF</button></div>
        <div className="table-wrap annual-table-wrap"><table><thead><tr><th>Worker name</th><th>Total salary earned</th><th>Bonus rate</th><th>Diwali Bonus</th><th>Earned Leave Salary</th><th>Closing advance</th><th>Final Bonus</th></tr></thead><tbody>
          {report.rows.map((row) => <tr key={row.employeeId}><td><strong>{row.name}</strong>{row.employeeCode && <small>{row.employeeCode}</small>}</td><td>{formatMoney(row.salaryEarned)}</td><td>{row.bonusRate}</td><td>{formatMoney(row.diwaliBonus)}</td><td>{formatMoney(row.earnedLeaveSalary)}</td><td className={Number(row.closingAdvance) < 0 ? "balance-held" : "balance-advance"}>{formatMoney(row.closingAdvance)}</td><td className="annual-final-bonus">{formatMoney(row.finalBonus)}</td></tr>)}
          <tr className="annual-total-row"><td><strong>Total</strong></td><td>{formatMoney(report.totals.salaryEarned)}</td><td>{report.totals.bonusRate}</td><td>{formatMoney(report.totals.diwaliBonus)}</td><td>{formatMoney(report.totals.earnedLeaveSalary)}</td><td>{formatMoney(report.totals.closingAdvance)}</td><td>{formatMoney(report.totals.finalBonus)}</td></tr>
        </tbody></table></div>
      </div>
    </section>}
  </div>;
}
