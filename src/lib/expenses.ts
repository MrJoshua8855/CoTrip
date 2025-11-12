import { prisma } from './db';

interface TripMember {
  userId: string;
  costPercentage?: number | null;
}

interface CustomSplit {
  userId: string;
  amount?: number;
  percentage?: number;
}

interface SplitResult {
  userId: string;
  amount: number;
  percentage: number;
}

/**
 * Main function to calculate expense splits based on split type
 */
export function calculateExpenseSplits(
  totalAmount: number,
  splitType: string,
  members: TripMember[],
  customSplits?: CustomSplit[]
): SplitResult[] {
  switch (splitType) {
    case 'equal':
      return calculateEqualSplit(totalAmount, members);

    case 'percentage':
      return calculatePercentageSplit(totalAmount, members, customSplits);

    case 'amount':
      return calculateAmountSplit(totalAmount, members, customSplits);

    case 'opt_in':
      return calculateOptInSplit(totalAmount, members, customSplits);

    default:
      throw new Error(`Invalid split type: ${splitType}`);
  }
}

/**
 * Calculate equal split - divide amount equally among all members
 */
function calculateEqualSplit(
  totalAmount: number,
  members: TripMember[]
): SplitResult[] {
  if (members.length === 0) {
    throw new Error('Cannot split among zero members');
  }

  const perPerson = totalAmount / members.length;
  const percentage = 100 / members.length;

  // Handle rounding: give the last person any remainder
  const splits = members.map((member, index) => {
    if (index === members.length - 1) {
      // Last person gets the remainder to ensure total matches
      const previousTotal = perPerson * (members.length - 1);
      return {
        userId: member.userId,
        amount: totalAmount - previousTotal,
        percentage,
      };
    }
    return {
      userId: member.userId,
      amount: perPerson,
      percentage,
    };
  });

  return splits;
}

/**
 * Calculate percentage split - custom percentage for each member
 */
function calculatePercentageSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
): SplitResult[] {
  if (!customSplits || customSplits.length === 0) {
    // Try to use trip default percentages if available
    const totalPercentage = members.reduce(
      (sum, m) => sum + (typeof m.costPercentage === 'number' ? Number(m.costPercentage) : 0),
      0
    );

    if (totalPercentage > 0) {
      // Validate percentages sum to ~100
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Trip default percentages must sum to 100, got ${totalPercentage}`);
      }

      return members.map((member, index) => {
        const percentage = typeof member.costPercentage === 'number'
          ? Number(member.costPercentage)
          : 0;

        // Last member gets remainder to ensure total matches
        if (index === members.length - 1) {
          const previousTotal = members
            .slice(0, -1)
            .reduce((sum, m) => {
              const pct = typeof m.costPercentage === 'number'
                ? Number(m.costPercentage)
                : 0;
              return sum + (totalAmount * pct) / 100;
            }, 0);

          return {
            userId: member.userId,
            amount: totalAmount - previousTotal,
            percentage,
          };
        }

        return {
          userId: member.userId,
          amount: (totalAmount * percentage) / 100,
          percentage,
        };
      });
    }

    // Fallback to equal split
    return calculateEqualSplit(totalAmount, members);
  }

  // Validate custom percentages sum to 100
  const totalPercentage = customSplits.reduce(
    (sum, split) => sum + (split.percentage || 0),
    0
  );

  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100, got ${totalPercentage}`);
  }

  // Calculate amounts from percentages
  return customSplits.map((split, index) => {
    const percentage = split.percentage || 0;

    // Last split gets remainder to ensure total matches
    if (index === customSplits.length - 1) {
      const previousTotal = customSplits
        .slice(0, -1)
        .reduce((sum, s) => sum + (totalAmount * (s.percentage || 0)) / 100, 0);

      return {
        userId: split.userId,
        amount: totalAmount - previousTotal,
        percentage,
      };
    }

    return {
      userId: split.userId,
      amount: (totalAmount * percentage) / 100,
      percentage,
    };
  });
}

/**
 * Calculate amount split - specific amounts for each member
 */
function calculateAmountSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
): SplitResult[] {
  if (!customSplits || customSplits.length === 0) {
    throw new Error('Custom amounts required for amount split type');
  }

  // Validate amounts sum to total
  const totalSplit = customSplits.reduce(
    (sum, split) => sum + (split.amount || 0),
    0
  );

  if (Math.abs(totalSplit - totalAmount) > 0.01) {
    throw new Error(
      `Split amounts must sum to total amount. Expected ${totalAmount}, got ${totalSplit}`
    );
  }

  return customSplits.map((split) => {
    const amount = split.amount || 0;
    return {
      userId: split.userId,
      amount,
      percentage: (amount / totalAmount) * 100,
    };
  });
}

/**
 * Calculate opt-in split - equal split among only opted-in members
 */
function calculateOptInSplit(
  totalAmount: number,
  members: TripMember[],
  customSplits?: CustomSplit[]
): SplitResult[] {
  // Only split among users who opted in (provided in customSplits)
  if (!customSplits || customSplits.length === 0) {
    throw new Error('At least one member must opt in for opt-in split type');
  }

  const optedInCount = customSplits.length;
  const perPerson = totalAmount / optedInCount;
  const percentage = 100 / optedInCount;

  // Handle rounding: give the last person any remainder
  return customSplits.map((split, index) => {
    if (index === customSplits.length - 1) {
      // Last person gets the remainder
      const previousTotal = perPerson * (optedInCount - 1);
      return {
        userId: split.userId,
        amount: totalAmount - previousTotal,
        percentage,
      };
    }
    return {
      userId: split.userId,
      amount: perPerson,
      percentage,
    };
  });
}

/**
 * Validate expense split data
 */
export function validateExpenseSplit(
  totalAmount: number,
  splitType: string,
  members: TripMember[],
  customSplits?: CustomSplit[]
): { valid: boolean; error?: string } {
  try {
    const splits = calculateExpenseSplits(totalAmount, splitType, members, customSplits);

    // Verify splits sum to total
    const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplit - totalAmount) > 0.01) {
      return {
        valid: false,
        error: `Splits sum to ${totalSplit} but total is ${totalAmount}`,
      };
    }

    // Verify all users are trip members
    const memberIds = new Set(members.map(m => m.userId));
    for (const split of splits) {
      if (!memberIds.has(split.userId)) {
        return {
          valid: false,
          error: `User ${split.userId} is not a trip member`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate user balances for a trip
 */
export async function calculateTripBalances(tripId: string) {
  const expenses = await prisma.expense.findMany({
    where: {
      tripId,
      status: { not: 'rejected' }
    },
    include: {
      splits: true,
    },
  });

  const balances = new Map<string, number>();

  expenses.forEach((expense) => {
    if (!expense.paidById) return;

    // Add amount paid
    const currentPaid = balances.get(expense.paidById) || 0;
    balances.set(
      expense.paidById,
      currentPaid + Number(expense.amount)
    );

    // Subtract amounts owed
    expense.splits.forEach((split) => {
      const currentOwed = balances.get(split.userId) || 0;
      balances.set(
        split.userId,
        currentOwed - Number(split.amount)
      );
    });
  });

  return Array.from(balances.entries()).map(([userId, balance]) => ({
    userId,
    balance,
  }));
}

/**
 * Get expense summary for a trip
 */
export async function getExpenseSummary(tripId: string) {
  const expenses = await prisma.expense.findMany({
    where: {
      tripId,
      status: { not: 'rejected' }
    },
    include: {
      paidBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
      splits: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category || 'other';
    acc[category] = (acc[category] || 0) + Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  const expensesByUser = expenses.reduce((acc, expense) => {
    if (!expense.paidById) return acc;
    const userId = expense.paidById;
    acc[userId] = (acc[userId] || 0) + Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  return {
    totalExpenses,
    expenseCount: expenses.length,
    expensesByCategory,
    expensesByUser,
  };
}
