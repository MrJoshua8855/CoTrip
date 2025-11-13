import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { calculateExpenseSplits, validateExpenseSplit } from '@/lib/expenses';

// Validation schemas
const customSplitSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percentage: z.number().optional(),
});

const createExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  category: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  receiptUrl: z.string().url().optional().nullable(),
  expenseDate: z.string().datetime().optional(),
  splitType: z.enum(['equal', 'percentage', 'amount', 'opt_in']).default('equal'),
  splits: z.array(customSplitSchema).optional(),
  relatedProposalId: z.string().optional().nullable(),
  relatedFeatureId: z.string().optional().nullable(),
});

// GET /api/trips/[tripId]/expenses - List expenses for a trip
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a trip member
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: params.tripId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters for filtering
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const expenses = await prisma.expense.findMany({
      where: {
        tripId: params.tripId,
        ...(category && { category }),
        ...(status && { status }),
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
        relatedProposal: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        relatedFeature: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    // Convert Decimal to number for JSON serialization
    const serializedExpenses = expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      splits: expense.splits.map((split) => ({
        ...split,
        amount: Number(split.amount),
        percentage: split.percentage ? Number(split.percentage) : null,
      })),
    }));

    return NextResponse.json(serializedExpenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// POST /api/trips/[tripId]/expenses - Create new expense
export async function POST(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a trip member
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: params.tripId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = createExpenseSchema.parse(body);

    // Get trip members for split calculation
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: params.tripId,
        status: 'active',
      },
      select: {
        userId: true,
        costPercentage: true,
      },
    });

    if (members.length === 0) {
      return NextResponse.json(
        { error: 'No active members in trip' },
        { status: 400 }
      );
    }

    // Calculate splits based on type
    const splits = calculateExpenseSplits(
      validated.amount,
      validated.splitType,
      members,
      validated.splits
    );

    // Validate splits
    const validation = validateExpenseSplit(
      validated.amount,
      validated.splitType,
      members,
      validated.splits
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Verify splits sum to total (within rounding tolerance)
    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplit - validated.amount) > 0.01) {
      return NextResponse.json(
        {
          error: `Splits do not sum to total amount. Expected ${validated.amount}, got ${totalSplit}`,
        },
        { status: 400 }
      );
    }

    // Create expense with splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          tripId: params.tripId,
          paidById: session.user.id,
          amount: validated.amount,
          currency: validated.currency,
          category: validated.category,
          description: validated.description,
          receiptUrl: validated.receiptUrl,
          expenseDate: validated.expenseDate
            ? new Date(validated.expenseDate)
            : new Date(),
          splitType: validated.splitType,
          relatedProposalId: validated.relatedProposalId,
          relatedFeatureId: validated.relatedFeatureId,
          status: 'pending',
        },
      });

      // Create splits
      await tx.expenseSplit.createMany({
        data: splits.map((split) => ({
          expenseId: newExpense.id,
          userId: split.userId,
          amount: split.amount,
          percentage: split.percentage,
        })),
      });

      return newExpense;
    });

    // Fetch the complete expense with relations
    const completeExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
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

    // Create notifications for other members
    const otherMembers = members.filter((m) => m.userId !== session.user.id);
    if (otherMembers.length > 0) {
      await prisma.notification.createMany({
        data: otherMembers.map((m) => ({
          userId: m.userId,
          tripId: params.tripId,
          type: 'new_expense',
          title: 'New Expense',
          message: `${session.user.name || session.user.email} added expense: ${validated.description}`,
          data: { expenseId: expense.id },
        })),
      });
    }

    // Serialize for JSON response
    const serialized = {
      ...completeExpense,
      amount: Number(completeExpense!.amount),
      splits: completeExpense!.splits.map((split) => ({
        ...split,
        amount: Number(split.amount),
        percentage: split.percentage ? Number(split.percentage) : null,
      })),
    };

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating expense:', error);
    return NextResponse.json(
      {
        error: 'Failed to create expense',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
