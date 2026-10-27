export type Unit = { id: number; name: string };
export type Employee = {
  id: number;
  name: string;
  employeeCode?: string | null;
  startingAdvanceBalance: string;
  openingBalance?: string;
  unitId: number;
};
export type RecordRow = {
  id: number;
  employeeId: number;
  period: string;
  totalDays: number;
  shift8Days: number;
  shift12Days: number;
  shift8Rate: string;
  shift12Rate: string;
  salaryEarned: string;
  cashPaid: string;
  bankPaid: string;
  advanceRequested: string;
  openingBalance: string;
  closingBalance: string;
  employee: { id: number; name: string; employeeCode?: string | null };
};
export type Form = {
  employeeId: string;
  totalDays: string;
  shift8Days: string;
  shift12Days: string;
  shift8Rate: string;
  shift12Rate: string;
  cashPaid: string;
  bankPaid: string;
  advanceRequested: string;
};
export type FormField = keyof Form;
export type FieldErrors = Partial<Record<FormField, string>>;

export type AnnualOptions = { latestPeriod: string | null; earliestPeriod: string | null };
export type AnnualLeaveWorker = { employeeId: number; name: string; employeeCode: string | null; recordCount: number; totalLeaves: number; perDaySalary: string; saved: boolean };
export type AnnualLeaveData = { unit: Unit; startPeriod: string; endPeriod: string; workers: AnnualLeaveWorker[] };
export type AnnualReportRow = { employeeId: number; name: string; employeeCode: string | null; salaryEarned: string; bonusRate: string; diwaliBonus: string; earnedLeaveSalary: string; closingAdvance: string; finalBonus: string };
export type AnnualReportData = { unit: Unit; startPeriod: string; endPeriod: string; rows: AnnualReportRow[]; totals: { salaryEarned: string; bonusRate: string; diwaliBonus: string; earnedLeaveSalary: string; closingAdvance: string; finalBonus: string } };
