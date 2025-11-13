import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  calculateBalances,
  calculateOptimalSettlements,
  getSettlementStats,
  calculateTransactionSavings,
  validateSettlement,
} from '@/lib/settlements';

// Validation schema for marking settlement as paid
const markSettlementPaidSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/trips/[tripId]/settlements - Calculate optimal settlements
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

    // Get all expenses with splits
    const expenses = await prisma.expense.findMany({
      where: {
        tripId: params.tripId,
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
    const suggestedSettlements = calculateOptimalSettlements(balances);

    // Get existing settlement records
    const existingSettlements = await prisma.settlement.findMany({
      where: { tripId: params.tripId },
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
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total expenses
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    // Get statistics
    const stats = getSettlementStats(suggestedSettlements);
    const savings = calculateTransactionSavings(balances, suggestedSettlements);

    // Serialize existing settlements
    const serializedExisting = existingSettlements.map((s) => ({
      ...s,
      amount: Number(s.amount),
    }));

    return NextResponse.json({
      balances,
      suggestedSettlements,
      existingSettlements: serializedExisting,
      totalExpenses,
      stats,
      savings,
    });
  } catch (error) {
    console.error('Error calculating settlements:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate settlements',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/trips/[tripId]/settlements - Mark settlement as paid
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
    const validated = markSettlementPaidSchema.parse(body);

    // Verify user is the payer (fromUser)
    if (validated.fromUserId !== session.user.id) {
      // Allow trip organizers/owners to mark settlements
      if (membership.role !== 'owner' && membership.role !== 'organizer') {
        return NextResponse.json(
          { error: 'Only the payer or trip organizers can mark settlements as paid' },
          { status: 403 }
        );
      }
    }

    // Optionally validate the settlement amount matches calculated settlements
    // Get current balances and settlements
    const expenses = await prisma.expense.findMany({
      where: {
        tripId: params.tripId,
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

    const balances = calculateBalances(expenses);
    const calculatedSettlements = calculateOptimalSettlements(balances);

    // Validate settlement matches calculation (with tolerance)
    const validation = validateSettlement(
      validated.fromUserId,
      validated.toUserId,
      validated.amount,
      calculatedSettlements
    );

    if (!validation.valid) {
      console.warn('Settlement validation warning:', validation.error);
      // Don't block, just warn - amounts might be slightly different due to rounding
      // or user might be making partial payment
    }

    // Create settlement record
    const settlement = await prisma.settlement.create({
      data: {
        tripId: params.tripId,
        fromUserId: validated.fromUserId,
        toUserId: validated.toUserId,
        amount: validated.amount,
        currency: 'USD', // TODO: get from trip settings
        status: 'paid',
        paymentMethod: validated.paymentMethod,
        paymentReference: validated.paymentReference,
        notes: validated.notes,
        paidAt: new Date(),
      },
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

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        userId: validated.toUserId,
        tripId: params.tripId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `${settlement.fromUser?.fullName || 'Someone'} marked a payment of $${validated.amount.toFixed(2)} as complete`,
        data: { settlementId: settlement.id },
      },
    });

    // Serialize for JSON response
    const serialized = {
      ...settlement,
      amount: Number(settlement.amount),
    };

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating settlement:', error);
    return NextResponse.json(
      {
        error: 'Failed to create settlement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
