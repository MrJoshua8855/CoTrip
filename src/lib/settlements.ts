import { prisma } from './db';

interface UserBalance {
  userId: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  paid: number;
  owed: number;
  balance: number;
}

interface Settlement {
  from: string;
  fromUser: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  to: string;
  toUser: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  amount: number;
}

/**
 * Calculate net balances from expenses
 * Balance = Total Paid - Total Owed
 */
export function calculateBalances(expenses: any[]): UserBalance[] {
  const balances = new Map<string, UserBalance>();

  expenses.forEach((expense) => {
    const paidById = expense.paidById;
    if (!paidById) return;

    // Initialize balance for payer if not exists
    if (!balances.has(paidById)) {
      balances.set(paidById, {
        userId: paidById,
        user: expense.paidBy,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    // Add paid amount
    const payerBalance = balances.get(paidById)!;
    payerBalance.paid += Number(expense.amount);

    // Process splits
    expense.splits.forEach((split: any) => {
      if (!balances.has(split.userId)) {
        balances.set(split.userId, {
          userId: split.userId,
          user: split.user,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }

      const userBalance = balances.get(split.userId)!;
      userBalance.owed += Number(split.amount);
    });
  });

  // Calculate final balances (paid - owed)
  balances.forEach((balance) => {
    balance.balance = balance.paid - balance.owed;
  });

  return Array.from(balances.values());
}

/**
 * Calculate optimal settlements using greedy algorithm
 * Minimizes number of transactions needed to settle all debts
 *
 * Algorithm:
 * 1. Separate users into creditors (positive balance) and debtors (negative balance)
 * 2. Sort both by absolute amount (descending)
 * 3. Match largest creditor with largest debtor
 * 4. Transfer minimum of (creditor balance, debtor balance)
 * 5. Update balances and remove settled users
 * 6. Repeat until all settled
 */
export function calculateOptimalSettlements(
  balances: UserBalance[]
): Settlement[] {
  const EPSILON = 0.01; // Tolerance for floating point comparison

  // Filter out users with zero balance
  const activeBalances = balances.filter(
    (b) => Math.abs(b.balance) > EPSILON
  );

  // Separate creditors (owed money) and debtors (owe money)
  const creditors = activeBalances
    .filter((b) => b.balance > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance); // Highest first

  const debtors = activeBalances
    .filter((b) => b.balance < -EPSILON)
    .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance); // Highest first

  const settlements: Settlement[] = [];
  let creditorIdx = 0;
  let debtorIdx = 0;

  while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
    const creditor = creditors[creditorIdx];
    const debtor = debtors[debtorIdx];

    // Determine transfer amount (minimum of what's owed and what's due)
    const amount = Math.min(creditor.balance, debtor.balance);

    // Round to 2 decimal places
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      settlements.push({
        from: debtor.userId,
        fromUser: debtor.user,
        to: creditor.userId,
        toUser: creditor.user,
        amount: roundedAmount,
      });
    }

    // Update balances
    creditor.balance -= roundedAmount;
    debtor.balance -= roundedAmount;

    // Move to next creditor/debtor if settled
    if (creditor.balance < EPSILON) creditorIdx++;
    if (debtor.balance < EPSILON) debtorIdx++;
  }

  return settlements;
}

/**
 * Verify that settlements will result in all balances becoming zero
 */
export function verifySettlements(
  balances: UserBalance[],
  settlements: Settlement[]
): boolean {
  const EPSILON = 0.01;
  const finalBalances = new Map<string, number>();

  // Initialize with current balances
  balances.forEach((b) => {
    finalBalances.set(b.userId, b.balance);
  });

  // Apply settlements
  settlements.forEach((settlement) => {
    const fromBalance = finalBalances.get(settlement.from) || 0;
    const toBalance = finalBalances.get(settlement.to) || 0;

    // From user pays, so their balance increases (becomes less negative or more positive)
    finalBalances.set(settlement.from, fromBalance + settlement.amount);
    // To user receives, so their balance decreases (becomes less positive)
    finalBalances.set(settlement.to, toBalance - settlement.amount);
  });

  // Check all balances are ~0
  for (const balance of finalBalances.values()) {
    if (Math.abs(balance) > EPSILON) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate statistics for settlements
 */
export function getSettlementStats(settlements: Settlement[]) {
  if (settlements.length === 0) {
    return {
      totalTransactions: 0,
      totalAmount: 0,
      avgAmount: 0,
      maxAmount: 0,
      minAmount: 0,
    };
  }

  const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
  const avgAmount = totalAmount / settlements.length;
  const maxAmount = Math.max(...settlements.map((s) => s.amount));
  const minAmount = Math.min(...settlements.map((s) => s.amount));

  return {
    totalTransactions: settlements.length,
    totalAmount,
    avgAmount,
    maxAmount,
    minAmount,
  };
}

/**
 * Calculate how many transactions are saved compared to naive approach
 * Naive approach: everyone pays everyone they owe directly
 */
export function calculateTransactionSavings(
  balances: UserBalance[],
  settlements: Settlement[]
): { naiveCount: number; optimizedCount: number; saved: number; savingsPercentage: number } {
  // Count potential direct transactions (naive approach)
  // In worst case, every debtor pays every creditor
  const debtors = balances.filter((b) => b.balance < -0.01);
  const creditors = balances.filter((b) => b.balance > 0.01);

  // Naive approach: each debtor might need to pay each creditor
  const naiveCount = debtors.length * creditors.length;
  const optimizedCount = settlements.length;
  const saved = naiveCount - optimizedCount;
  const savingsPercentage = naiveCount > 0 ? (saved / naiveCount) * 100 : 0;

  return {
    naiveCount,
    optimizedCount,
    saved,
    savingsPercentage,
  };
}

/**
 * Get settlement summary for a trip
 */
export async function getSettlementSummary(tripId: string) {
  // Get all expenses with splits
  const expenses = await prisma.expense.findMany({
    where: {
      tripId,
      status: { not: 'rejected' },
    },
    include: {
      paidBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
      splits: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  // Calculate balances
  const balances = calculateBalances(expenses);

  // Calculate optimal settlements
  const settlements = calculateOptimalSettlements(balances);

  // Get existing settlement records
  const existingSettlements = await prisma.settlement.findMany({
    where: { tripId },
    include: {
      fromUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
      toUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Calculate total expenses
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  // Get statistics
  const stats = getSettlementStats(settlements);
  const savings = calculateTransactionSavings(balances, settlements);

  return {
    balances,
    suggestedSettlements: settlements,
    existingSettlements,
    totalExpenses,
    stats,
    savings,
  };
}

/**
 * Validate settlement amount matches what's calculated
 */
export function validateSettlement(
  fromUserId: string,
  toUserId: string,
  amount: number,
  calculatedSettlements: Settlement[]
): { valid: boolean; error?: string } {
  const EPSILON = 0.01;

  // Find matching settlement
  const matching = calculatedSettlements.find(
    (s) => s.from === fromUserId && s.to === toUserId
  );

  if (!matching) {
    return {
      valid: false,
      error: 'No settlement found from this user to that user',
    };
  }

  if (Math.abs(matching.amount - amount) > EPSILON) {
    return {
      valid: false,
      error: `Amount mismatch. Expected ${matching.amount}, got ${amount}`,
    };
  }

  return { valid: true };
}
