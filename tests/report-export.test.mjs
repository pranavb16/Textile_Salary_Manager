import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { annualExcelReport } from "../apps/web/src/lib/export-report.ts";

function report(rates, totalRate) {
  const amounts = { salaryEarned: "8100.00", diwaliBonus: "891.00", earnedLeaveSalary: "0.00", closingAdvance: "0.00", finalBonus: "891" };
  return annualExcelReport({
    unit: { id: 1, name: "Test Unit 1" }, startPeriod: "2025-10", endPeriod: "2026-11",
    rows: rates.map((bonusRate, index) => ({ employeeId: index, name: `Worker ${index}`, employeeCode: null, ...amounts, bonusRate })),
    totals: { ...amounts, bonusRate: totalRate },
  });
}

test("annual export converts API percentage strings and preserves mixed-rate totals", async () => {
  const data = report(["11.00%", "8.33%"], "Varies");
  assert.deepEqual(data.rows.map((row) => row[3]), [11, 8.33]);
  assert.equal(data.totals[3], "Varies");
  // Read the serialized workbook back to verify Excel receives numeric cells.
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRows([data.headers, ...data.rows, data.totals]);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(restored.worksheets[0].getCell("D2").value, 11);
  assert.equal(restored.worksheets[0].getCell("D3").value, 8.33);
  assert.equal(restored.worksheets[0].getCell("D4").value, "Varies");
});

test("annual export handles uniform totals, plain rates, zero and unavailable rates", () => {
  assert.equal(report(["8.33%"], "8.33%").totals[3], 8.33);
  const data = report(["8.33", "0.00%", " 11.00% ", "—", "", "invalid"], "—");
  assert.deepEqual(data.rows.map((row) => row[3]), [8.33, 0, 11, "—", "", "invalid"]);
  assert.equal(data.totals[3], "—");
  assert.equal(report([], "—").rows.length, 0);
});
