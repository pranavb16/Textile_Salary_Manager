import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

const maxInteger = 2_147_483_647;

export class CreateEmployeeDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString({ message: "Name must be text." })
  @MinLength(1, { message: "Name is required." })
  @MaxLength(120, { message: "Name cannot exceed 120 characters." })
  @Matches(/^(?=.*\p{L})[\p{L}\p{N} ]+$/u, {
    message: "Use letters, numbers, and spaces; include a letter.",
  })
  name!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() || null : value)
  @IsOptional()
  @IsString({ message: "Code must be text." })
  @MaxLength(40, { message: "Code cannot exceed 40 characters." })
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
    message: "Use letters, numbers, and single hyphens.",
  })
  employeeCode?: string | null;

  @IsInt({ message: "Unit ID must be an integer." })
  @Min(1, { message: "Unit ID must be positive." })
  @Max(maxInteger, { message: "Unit ID is too large." })
  unitId!: number;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString({ message: "Starting balance must be text." })
  @Matches(/^-?\d{1,12}$/, {
    message: "Enter a whole-number starting balance.",
  })
  startingAdvanceBalance: string = "0";
}
