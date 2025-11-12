import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { calculateExpenseSplits, validateExpenseSplit } from '@/lib/expenses';

// Validation schema for update
const customSplitSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percentage: z.number().optional(),
});

const updateExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  description: z.string().min(1).optional(),
  receiptUrl: z.string().url().optional().nullable(),
  expenseDate: z.string().datetime().optional(),
  splitType: z.enum(['equal', 'percentage', 'amount', 'opt_in']).optional(),
  splits: z.array(customSplitSchema).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

// GET /api/expenses/[expenseId] - Get single expense details
export async function GET(
  req: NextRequest,
  { params }: { params: { expenseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.expenseId },
      include: {
        trip: {
          select: {
            id: true,
            name: true,
          },
        },
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
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if user has access to this expense (must be trip member)
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: expense.tripId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Serialize for JSON response
    const serialized = {
      ...expense,
      amount: Number(expense.amount),
      splits: expense.splits.map((split) => ({
        ...split,
        amount: Number(split.amount),
        percentage: split.percentage ? Number(split.percentage) : null,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    );
  }
}

// PUT /api/expenses/[expenseId] - Update expense
export async function PUT(
  req: NextRequest,
  { params }: { params: { expenseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.expenseId },
      include: {
        trip: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check permission: must be payer or trip organizer/owner
    const membership = expense.trip.members[0];
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canEdit =
      expense.paidById === session.user.id ||
      membership.role === 'owner' ||
      membership.role === 'organizer';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only the payer or trip organizers can edit expenses' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = updateExpenseSchema.parse(body);

    // If splits are being updated, recalculate
    let newSplits;
    if (validated.splits || validated.splitType) {
      const splitType = validated.splitType || expense.splitType;
      const amount = validated.amount || Number(expense.amount);

      // Get trip members
      const members = await prisma.tripMember.findMany({
        where: {
          tripId: expense.tripId,
          status: 'active',
        },
        select: {
          userId: true,
          costPercentage: true,
        },
      });

      newSplits = calculateExpenseSplits(
        amount,
        splitType,
        members,
        validated.splits
      );

      // Validate splits
      const validation = validateExpenseSplit(
        amount,
        splitType,
        members,
        validated.splits
      );

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    // Update expense and splits atomically
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // Update expense
      const updated = await tx.expense.update({
        where: { id: params.expenseId },
        data: {
          ...(validated.amount !== undefined && { amount: validated.amount }),
          ...(validated.currency && { currency: validated.currency }),
          ...(validated.category !== undefined && { category: validated.category }),
          ...(validated.description && { description: validated.description }),
          ...(validated.receiptUrl !== undefined && { receiptUrl: validated.receiptUrl }),
          ...(validated.expenseDate && { expenseDate: new Date(validated.expenseDate) }),
          ...(validated.splitType && { splitType: validated.splitType }),
          ...(validated.status && { status: validated.status }),
        },
      });

      // If splits changed, delete old and create new
      if (newSplits) {
        await tx.expenseSplit.deleteMany({
          where: { expenseId: params.expenseId },
        });

        await tx.expenseSplit.createMany({
          data: newSplits.map((split) => ({
            expenseId: params.expenseId,
            userId: split.userId,
            amount: split.amount,
            percentage: split.percentage,
          })),
        });
      }

      return updated;
    });

    // Fetch complete expense with relations
    const completeExpense = await prisma.expense.findUnique({
      where: { id: params.expenseId },
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

    return NextResponse.json(serialized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating expense:', error);
    return NextResponse.json(
      {
        error: 'Failed to update expense',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/[expenseId] - Delete expense
export async function DELETE(
  req: NextRequest,
  { params }: { params: { expenseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.expenseId },
      include: {
        trip: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check permission: must be payer or trip organizer/owner
    const membership = expense.trip.members[0];
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canDelete =
      expense.paidById === session.user.id ||
      membership.role === 'owner' ||
      membership.role === 'organizer';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only the payer or trip organizers can delete expenses' },
        { status: 403 }
      );
    }

    // Delete expense (cascade will delete splits)
    await prisma.expense.delete({
      where: { id: params.expenseId },
    });

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
