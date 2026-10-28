import { z } from "zod";

const money = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount.");
const optionalShiftRate = z.string().trim().refine((amount) => amount === "" || /^\d{1,12}(\.\d{1,2})?$/.test(amount), "Enter a valid amount.");
const shiftDayCount = z.number().int().nonnegative().max(2_147_483_647, "Enter a valid number of days.");

const unitName = z.string().trim().min(1, "Enter a unit name.").max(100, "Unit name must be 100 characters or fewer.").regex(/^(?=.*\p{L})[\p{L}\p{N} ]+$/u, "Use letters and numbers, with at least one letter.");
const employeeName = z.string().trim().min(1, "Enter a worker name.").max(120, "Worker name must be 120 characters or fewer.").regex(/^(?=.*\p{L})[\p{L}\p{N} ]+$/u, "Use letters and numbers, with at least one letter.");
const employeeCode = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(40, "Employee code must be 40 characters or fewer.").regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, "Use letters, numbers, and hyphens.").nullable().optional(),
);

export const createUnitSchema = z.object({ name: unitName });
export const createEmployeeSchema = z.object({
  name: employeeName,
  employeeCode,
  unitId: z.number().int().positive().max(2_147_483_647),
  startingAdvanceBalance: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().regex(/^-?\d{1,12}$/, "Enter a whole-number starting balance.").default("0"),
  ),
});

export const payrollEntrySchema = z.object({
  employeeId: z.number().int().positive().max(2_147_483_647),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  isMender: z.boolean().default(false),
  mendingMetres: money.optional(),
  mendingRate: money.optional(),
  totalDays: shiftDayCount,
  shift8Days: shiftDayCount,
  shift12Days: shiftDayCount,
  shift8Rate: optionalShiftRate,
  shift12Rate: optionalShiftRate,
  cashPaid: money,
  bankPaid: money,
  advanceRequested: money,
}).superRefine((entry, context) => {
  if (entry.isMender) {
    if (!entry.mendingMetres || Number(entry.mendingMetres) <= 0) context.addIssue({ code: "custom", message: "Enter metres greater than 0.", path: ["mendingMetres"] });
    if (!entry.mendingRate || Number(entry.mendingRate) <= 0) context.addIssue({ code: "custom", message: "Enter a rate greater than 0.", path: ["mendingRate"] });
    return;
  }
  if (entry.totalDays < 1) context.addIssue({ code: "custom", message: "Enter at least 1 day.", path: ["totalDays"] });
  if (entry.shift8Days + entry.shift12Days !== entry.totalDays) {
    context.addIssue({ code: "custom", message: "Shift days must be equal to total days.", path: ["totalDays"] });
  }
  if (entry.shift8Days > 0 && Number(entry.shift8Rate) <= 0) {
    context.addIssue({ code: "custom", message: "Enter a rate above 0 for 8-hour shifts.", path: ["shift8Rate"] });
  }
  if (entry.shift12Days > 0 && Number(entry.shift12Rate) <= 0) {
    context.addIssue({ code: "custom", message: "Enter a rate above 0 for 12-hour shifts.", path: ["shift12Rate"] });
  }
}).transform((entry) => ({
  ...entry,
  mendingMetres: entry.isMender ? entry.mendingMetres : undefined,
  mendingRate: entry.isMender ? entry.mendingRate : undefined,
  shift8Rate: entry.shift8Rate.trim() === "" ? "0" : entry.shift8Rate,
  shift12Rate: entry.shift12Rate.trim() === "" ? "0" : entry.shift12Rate,
}));

export const payrollFormSchema = z.object({
  employeeId: z.string().regex(/^[1-9]\d*$/, "Choose one worker."),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a payroll month."),
  isMender: z.boolean(),
  mendingMetres: z.string(),
  mendingRate: z.string(),
  totalDays: z.string(),
  shift8Days: z.string(),
  shift12Days: z.string(),
  shift8Rate: z.string(),
  shift12Rate: z.string(),
  cashPaid: money,
  bankPaid: money,
  advanceRequested: money,
}).superRefine((entry, context) => {
  if (!entry.isMender) {
    for (const field of ["totalDays", "shift8Days", "shift12Days"] as const) {
      if (!/^\d*$/.test(entry[field])) context.addIssue({ code: "custom", message: "Enter a whole number of days.", path: [field] });
    }
  }
}).transform((entry): z.input<typeof payrollEntrySchema> => ({
  ...entry,
  employeeId: Number(entry.employeeId),
  totalDays: entry.isMender ? 0 : Number(entry.totalDays || 0),
  shift8Days: entry.isMender ? 0 : Number(entry.shift8Days || 0),
  shift12Days: entry.isMender ? 0 : Number(entry.shift12Days || 0),
  shift8Rate: entry.isMender ? "0" : entry.shift8Rate,
  shift12Rate: entry.isMender ? "0" : entry.shift12Rate,
  mendingMetres: entry.isMender ? entry.mendingMetres : undefined,
  mendingRate: entry.isMender ? entry.mendingRate : undefined,
})).pipe(payrollEntrySchema);

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type PayrollEntryInput = z.infer<typeof payrollEntrySchema>;

export const annualLeaveSaveSchema = z.object({
  endPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  workers: z.array(z.object({
    employeeId: z.number().int().positive(),
    recordCount: z.number().int().positive(),
    totalLeaves: z.number().int().min(0).max(365),
    perDaySalary: z.string().regex(/^\d{1,12}$/, "Enter a whole-number per-day salary."),
  })).min(1),
});

export type AnnualLeaveSaveInput = z.infer<typeof annualLeaveSaveSchema>;

export const annualBonusRateSchema = z.string().trim()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/, "Enter a positive bonus rate up to 100%, with up to two decimal places.")
  .refine((rate) => Number(rate) > 0, "Bonus rate must be greater than 0%.")
  .refine((rate) => Number(rate) <= 100, "Bonus rate cannot exceed 100%.");
