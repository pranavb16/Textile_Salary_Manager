import { FileDown } from "lucide-react";
import type { RecordRow } from "../../types.js";
import { formatMoney, money } from "../../lib/format-money.js";

export function PayrollReport({ unitSelected, title, records, onPrint, onEdit }: {
  unitSelected: boolean;
  title: string;
  records: RecordRow[];
  onPrint: () => void;
  onEdit: (record: RecordRow) => void;
}) {
  const reportTotal = records.reduce((sum, row) => sum + money(row.salaryEarned), 0);

  return <section className="report-section" aria-labelledby="monthly-report-title"><h2 id="monthly-report-title" className="report-section-title">Monthly report</h2>
    <div className="panel report-panel"><div className="report-head"><div><h2>{unitSelected ? title : "Salary report"}</h2><p>{records.length} worker{records.length === 1 ? "" : "s"} · earned total {formatMoney(reportTotal)}</p></div><button className="button button-outline" disabled={!unitSelected} onClick={onPrint}><FileDown size={17} /> Print / Save PDF</button></div>
      <div className="table-wrap"><table><thead><tr><th>Worker</th><th>Days</th><th>Salary earned</th><th>Cash paid</th><th>Bank paid</th><th>Opening advance</th><th>New advance issued</th><th>Closing advance</th><th className="screen-only">Edit</th></tr></thead><tbody>{records.map((row) => <tr key={row.id}><td><strong>{row.employee.name}</strong>{row.employee.employeeCode && <small>{row.employee.employeeCode}</small>}</td><td>{row.totalDays}<small>8h {row.shift8Days} · 12h {row.shift12Days}</small></td><td>{formatMoney(row.salaryEarned)}</td><td>{formatMoney(row.cashPaid)}</td><td>{formatMoney(row.bankPaid)}</td><td>{formatMoney(row.openingBalance)}</td><td>{formatMoney(row.advanceRequested)}</td><td className={money(row.closingBalance) < 0 ? "balance-held" : "balance-advance"}>{formatMoney(row.closingBalance)}</td><td className="screen-only"><button className="button edit-button" aria-label={`Edit payroll for ${row.employee.name}`} onClick={() => onEdit(row)}>Edit</button></td></tr>)}{!records.length && <tr><td colSpan={9} className="empty-row">No payroll entries for this unit and month yet.</td></tr>}</tbody></table></div>
    </div>
  </section>;
}
