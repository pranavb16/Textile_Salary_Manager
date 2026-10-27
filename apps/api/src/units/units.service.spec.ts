import { jest } from "@jest/globals";
import { ConflictException, InternalServerErrorException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { UnitsService } from "./units.service.js";

describe("UnitsService", () => {
  const prisma = {
    unit: {
      findMany: jest.fn<(...args: any[]) => Promise<unknown>>(),
      create: jest.fn<(...args: any[]) => Promise<unknown>>(),
    },
  };
  let service: UnitsService;
  beforeEach(() => { jest.clearAllMocks(); service = new UnitsService(prisma as never); });

  it("lists active units alphabetically", async () => {
    const units = [{ id: 1, name: "Cutting", active: true }, { id: 2, name: "Weaving", active: true }];
    prisma.unit.findMany.mockResolvedValue(units);

    const result = await service.getUnitDetails();

    expect(prisma.unit.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { name: "asc" } });
    expect(result).toBe(units);
  });

  it("creates and returns a unit", async () => {
    const unit = { id: 1, name: "Weaving", active: true };
    prisma.unit.create.mockResolvedValue(unit);

    await expect(service.createUnitDetails({ name: "Weaving" })).resolves.toBe(unit);
    expect(prisma.unit.create).toHaveBeenCalledWith({ data: { name: "Weaving" } });
  });

  it("turns duplicate unit names into a clear conflict", async () => {
    prisma.unit.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "test" }));

    await expect(service.createUnitDetails({ name: "Weaving" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("propagates unexpected database errors", async () => {
    const error = new InternalServerErrorException("Database unavailable");
    prisma.unit.create.mockRejectedValue(error);

    await expect(service.createUnitDetails({ name: "Weaving" })).rejects.toBe(error);
  });
});
