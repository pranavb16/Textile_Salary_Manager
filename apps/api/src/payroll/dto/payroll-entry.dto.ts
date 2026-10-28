import { Transform } from "class-transformer";
import {
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const maxInteger = 2_147_483_647;
const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/;

@ValidatorConstraint({ name: "shiftDaysMatchTotal", async: false })
class ShiftDaysMatchTotal implements ValidatorConstraintInterface {
  validate(totalDays: number, args: ValidationArguments) {
    const entry = args.object as PayrollEntryDto;
    return entry.shift8Days + entry.shift12Days === totalDays;
  }

  defaultMessage() {
    return "Shift days must equal total days.";
  }
}

@ValidatorConstraint({ name: "positiveRateForWorkedShift", async: false })
class PositiveRateForWorkedShift implements ValidatorConstraintInterface {
  validate(rate: string, args: ValidationArguments) {
    const entry = args.object as PayrollEntryDto;
    const daysField = args.constraints[0] as "shift8Days" | "shift12Days";
    return entry[daysField] === 0 || Number(rate) > 0;
  }

  defaultMessage(args: ValidationArguments) {
    const shift = args.constraints[0] === "shift8Days" ? "8-hour" : "12-hour";
    return `Enter a rate above 0 for ${shift} shifts.`;
  }
}

export class PayrollEntryDto {
  @IsInt()
  @Min(1)
  @Max(maxInteger)
  employeeId!: number;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Choose a valid payroll month." })
  period!: string;

  @IsOptional()
  @IsBoolean()
  isMender?: boolean;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender === true)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/, { message: "Enter metres greater than 0 with up to two decimal places." })
  mendingMetres?: string;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender === true)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/, { message: "Enter a rate greater than 0 with up to two decimal places." })
  mendingRate?: string;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender !== true)
  @IsInt()
  @Min(1, { message: "Enter at least 1 day." })
  @Max(maxInteger, { message: "Enter a valid number of days." })
  @Validate(ShiftDaysMatchTotal)
  totalDays!: number;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender !== true)
  @IsInt()
  @Min(0)
  @Max(maxInteger, { message: "Enter a valid number of days." })
  shift8Days!: number;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender !== true)
  @IsInt()
  @Min(0)
  @Max(maxInteger, { message: "Enter a valid number of days." })
  shift12Days!: number;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender !== true)
  @Transform(({ value }) => typeof value === "string" ? value.trim() || "0" : value)
  @IsString()
  @Matches(moneyPattern, { message: "Enter a valid amount." })
  @Validate(PositiveRateForWorkedShift, ["shift8Days"])
  shift8Rate!: string;

  @ValidateIf((entry: PayrollEntryDto) => entry.isMender !== true)
  @Transform(({ value }) => typeof value === "string" ? value.trim() || "0" : value)
  @IsString()
  @Matches(moneyPattern, { message: "Enter a valid amount." })
  @Validate(PositiveRateForWorkedShift, ["shift12Days"])
  shift12Rate!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Matches(moneyPattern, { message: "Enter a valid amount." })
  cashPaid!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Matches(moneyPattern, { message: "Enter a valid amount." })
  bankPaid!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Matches(moneyPattern, { message: "Enter a valid amount." })
  advanceRequested!: string;
}
