import type { AnnualLeaveSaveInput, CreateEmployeeInput, CreateUnitInput, PayrollEntryInput } from "@salary/contracts";
import type { AnnualLeaveData, AnnualOptions, AnnualReportData, Employee, RecordRow, Unit } from "../types.js";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "The request could not be completed.");
  return body as T;
}

export function getUnits() {
  return request<Unit[]>("/units");
}

export function getEmployees(unitId: string, period: string) {
  return request<Employee[]>(`/employees?unitId=${unitId}&period=${period}`);
}

export function getPayrollRecords(unitId: string, period: string) {
  return request<RecordRow[]>(`/payroll?unitId=${unitId}&period=${period}`);
}

export function savePayrollRecord(id: number | null, input: PayrollEntryInput) {
  return request(id ? `/payroll/${id}` : "/payroll", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
}

export function createUnit(input: CreateUnitInput) {
  return request("/units", { method: "POST", body: JSON.stringify(input) });
}

export function createEmployee(input: CreateEmployeeInput) {
  return request("/employees", { method: "POST", body: JSON.stringify(input) });
}

export function getAnnualOptions(unitId: string) {
  return request<AnnualOptions>(`/annual-reports/options?unitId=${encodeURIComponent(unitId)}`);
}

export function getAnnualLeaveData(unitId: string, startPeriod: string) {
  return request<AnnualLeaveData>(`/annual-reports/leave?unitId=${encodeURIComponent(unitId)}&startPeriod=${encodeURIComponent(startPeriod)}`);
}

export function saveAnnualLeaveData(unitId: string, startPeriod: string, input: AnnualLeaveSaveInput) {
  return request<AnnualLeaveData>(`/annual-reports/leave?unitId=${encodeURIComponent(unitId)}&startPeriod=${encodeURIComponent(startPeriod)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function getAnnualReport(unitId: string, startPeriod: string, bonusRate: string, menderBonusRate: string) {
  return request<AnnualReportData>(`/annual-reports?unitId=${encodeURIComponent(unitId)}&startPeriod=${encodeURIComponent(startPeriod)}&bonusRate=${encodeURIComponent(bonusRate)}&menderBonusRate=${encodeURIComponent(menderBonusRate)}`);
}
