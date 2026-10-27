import { jest } from "@jest/globals";
import { CreateUnitDto } from "./dto/create-unit.dto.js";
import { UnitsController } from "./units.controller.js";

describe("UnitsController", () => {
  const units = {
    getUnitDetails: jest.fn<() => Promise<unknown>>(),
    createUnitDetails: jest.fn<(input: CreateUnitDto) => Promise<unknown>>(),
  };
  let controller: UnitsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UnitsController(units as never);
  });

  it("delegates GET unit details to the service", async () => {
    const result = [{ id: 1, name: "Weaving", active: true }];
    units.getUnitDetails.mockResolvedValue(result);

    await expect(controller.getUnitDetails()).resolves.toBe(result);
    expect(units.getUnitDetails).toHaveBeenCalledTimes(1);
  });

  it("passes the create DTO to the service", async () => {
    const input = Object.assign(new CreateUnitDto(), { name: "Weaving" });
    const result = { id: 1, name: "Weaving", active: true };
    units.createUnitDetails.mockResolvedValue(result);

    await expect(controller.createUnitDetails(input)).resolves.toBe(result);
    expect(units.createUnitDetails).toHaveBeenCalledWith(input);
  });
});
