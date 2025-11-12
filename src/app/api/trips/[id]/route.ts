import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission } from '@/lib/permissions';

const updateTripSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  destination: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  costStructure: z.enum(['per_trip', 'per_user', 'custom']).optional(),
  totalBudget: z.number().optional(),
  currency: z.string().optional(),
  status: z.enum(['planning', 'booked', 'in_progress', 'completed', 'cancelled']).optional(),
});

// GET /api/trips/[id] - Get trip details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to this trip
    const hasAccess = await checkTripPermission(
      params.id,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        members: {
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
        parentTrip: {
          select: {
            id: true,
            name: true,
            destination: true,
          },
        },
        subTrips: {
          select: {
            id: true,
            name: true,
            destination: true,
            startDate: true,
            endDate: true,
          },
        },
        proposals: {
          where: { status: 'open' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            proposedBy: {
              select: {
                id: true,
                fullName: true,
              },
            },
            _count: {
              select: {
                votes: true,
              },
            },
          },
        },
        expenses: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            paidBy: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        _count: {
          select: {
            proposals: true,
            expenses: true,
            listItems: true,
            settlements: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip' },
      { status: 500 }
    );
  }
}

// PUT /api/trips/[id] - Update trip
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to edit
    const hasPermission = await checkTripPermission(
      params.id,
      session.user.id,
      'edit'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateTripSchema.parse(body);

    // Convert date strings to Date objects if present
    const updateData: any = { ...validated };
    if (validated.startDate) {
      updateData.startDate = new Date(validated.startDate);
    }
    if (validated.endDate) {
      updateData.endDate = new Date(validated.endDate);
    }

    const trip = await prisma.trip.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(trip);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating trip:', error);
    return NextResponse.json(
      { error: 'Failed to update trip' },
      { status: 500 }
    );
  }
}

// DELETE /api/trips/[id] - Delete trip
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is owner
    const hasPermission = await checkTripPermission(
      params.id,
      session.user.id,
      'delete'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.trip.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json(
      { error: 'Failed to delete trip' },
      { status: 500 }
    );
  }
}
