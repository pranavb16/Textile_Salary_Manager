import type { AnnualReportData, RecordRow } from "../types.js";

type Cell = string | number | null;
export type ExcelReport = { title: string; subtitle?: string; filename: string; headers: string[]; rows: Cell[][]; moneyColumns: number[]; totals?: Cell[] };

export function monthlyExcelReport(title: string, records: RecordRow[]): ExcelReport {
  return {
    title, filename: `Monthly report - ${title}`,
    headers: ["Worker name", "Employee code", "Days", "8h days", "12h days", "Salary earned", "Cash paid", "Bank paid", "Opening advance", "New advance issued", "Closing advance", "Sign"],
    rows: records.map((row) => [row.employee.name, row.employee.employeeCode ?? "", row.isMender ? null : row.totalDays, row.isMender ? null : row.shift8Days, row.isMender ? null : row.shift12Days, Number(row.salaryEarned), Number(row.cashPaid), Number(row.bankPaid), Number(row.openingBalance), Number(row.advanceRequested), Number(row.closingBalance), ""]),
    moneyColumns: [6, 7, 8, 9, 10, 11],
  };
}

function bonusRateCell(rate: string): Cell {
  // API rates include "%"; keep percentage points numeric under the (%) header.
  const value = rate.trim().replace(/%$/, "").trim();
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return rate;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : rate;
}

export function annualExcelReport(report: AnnualReportData): ExcelReport {
  // The total can contain a rate or a label such as "Varies" or "—".
  const values = (row: AnnualReportData["totals"]): Cell[] => [Number(row.salaryEarned), bonusRateCell(row.bonusRate), Number(row.diwaliBonus), Number(row.earnedLeaveSalary), Number(row.closingAdvance), Number(row.finalBonus)];
  return {
    title: `Annual Salary Report · ${report.unit.name}`,
    subtitle: `${report.startPeriod} to ${report.endPeriod}`,
    filename: `Annual report - ${report.unit.name} - ${report.startPeriod} to ${report.endPeriod}`,
    headers: ["Worker name", "Employee code", "Total salary earned", "Bonus rate (%)", "Diwali Bonus", "Earned Leave Salary", "Closing advance", "Final Bonus", "Sign"],
    rows: report.rows.map((row) => [row.name, row.employeeCode ?? "", ...values(row), ""]),
    totals: ["Total", "", ...values(report.totals), ""], moneyColumns: [3, 5, 6, 7, 8],
  };
}

export async function exportReport(report: ExcelReport) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow([report.title]).font = { bold: true, size: 16 };
  if (report.subtitle) sheet.addRow([report.subtitle]);
  sheet.addRow([]);
  const header = sheet.addRow(report.headers);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF175C42" } };
  // Leave enough vertical space for workers to sign a printed spreadsheet.
  report.rows.forEach((row) => { sheet.addRow(row).height = 30; });
  if (report.totals) sheet.addRow(report.totals).font = { bold: true };
  report.headers.forEach((label, index) => { sheet.getColumn(index + 1).width = Math.max(18, label.length + 3); });
  report.moneyColumns.forEach((index) => { sheet.getColumn(index).numFmt = '#,##0.00;[Red]-#,##0.00'; });
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + report.rows.length, column: report.headers.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "")}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
