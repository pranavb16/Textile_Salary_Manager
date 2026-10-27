import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import type { CreateUnitDto } from "./dto/create-unit.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  public getUnitDetails() {
    const filter = {
      where: { active: true },
      orderBy: { name: "asc" },
    } satisfies Prisma.UnitFindManyArgs;

    return this.prisma.unit.findMany(filter);
  }

  async createUnitDetails(input: CreateUnitDto) {
    try {
      return await this.prisma.unit.create({ data: { name: input.name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A unit with this name already exists.");
      }
      throw error;
    }
  }
}
