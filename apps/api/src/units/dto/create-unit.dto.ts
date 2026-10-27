import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUnitDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString({ message: "Unit name must be text." })
  @MinLength(1, { message: "Unit name is required." })
  @MaxLength(100, { message: "Unit name cannot exceed 100 characters." })
  @Matches(/^(?=.*\p{L})[\p{L}\p{N} ]+$/u, {
    message: "Use letters, numbers, and spaces; include at least one letter.",
  })
  // The value is assigned from the request at runtime by Nest's ValidationPipe.
  name!: string;
}
