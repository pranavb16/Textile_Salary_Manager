import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";

const maxStoredAmount = new Prisma.Decimal("999999999999.99");

// Helps to calculate the earned salary using the shift days and their respective rates
export function calculateEarnedSalary(
  shift8Days: number,
  shift8Rate: Prisma.Decimal,
  shift12Days: number,
  shift12Rate: Prisma.Decimal,
) {
  const salary = shift8Rate.mul(shift8Days).add(shift12Rate.mul(shift12Days));
  if (salary.greaterThan(maxStoredAmount)) throw new BadRequestException("The calculated salary exceeds the supported amount range.");
  return salary;
}

// Calculates the closing balance based on the input data
export function calculateClosingBalance(input: {
  openingBalance: Prisma.Decimal;
  newAdvance: Prisma.Decimal;
  salaryEarned: Prisma.Decimal;
  cashPaid: Prisma.Decimal;
  bankPaid: Prisma.Decimal;
}) {
  const paid = input.cashPaid.add(input.bankPaid);
  const available = input.salaryEarned.add(input.openingBalance.isNegative() ? input.openingBalance.abs() : 0);
  if (paid.greaterThan(available)) {
    throw new BadRequestException("Cash and bank payout cannot exceed salary plus salary previously held for this worker.");
  }
  const closingBalance = input.openingBalance.add(input.newAdvance).sub(input.salaryEarned.sub(paid));
  if (closingBalance.greaterThan(maxStoredAmount) || closingBalance.lessThan(maxStoredAmount.negated())) {
    throw new BadRequestException("The resulting advance balance exceeds the supported amount range.");
  }
  return closingBalance;
}
