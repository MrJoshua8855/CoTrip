import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission, getTripRole } from '@/lib/permissions';
import { getVoteResults } from '@/lib/voting';

// Validation schema for updating a proposal
const updateProposalSchema = z.object({
  category: z.enum(['accommodation', 'activity', 'transportation', 'dining', 'other']).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  status: z.enum(['open', 'closed', 'selected', 'rejected']).optional(),
  votingDeadline: z.string().datetime().optional(),
});

/**
 * GET /api/proposals/[proposalId]
 * Get a single proposal with details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the proposal
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
      include: {
        proposedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        trip: {
          select: {
            id: true,
            name: true,
            members: {
              where: { status: 'active' },
            },
          },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            votes: true,
            comments: true,
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if user has access to view this trip
    const hasAccess = await checkTripPermission(
      proposal.tripId,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Calculate vote results
    const voteResults = getVoteResults(
      proposal,
      proposal.votingType,
      [proposal],
      proposal.trip.members.length
    );

    return NextResponse.json({
      ...proposal,
      voteResults,
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/proposals/[proposalId]
 * Update a proposal
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the proposal
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
      include: {
        votes: true,
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check permissions: only creator or organizer/owner can update
    const isCreator = proposal.proposedById === session.user.id;
    const role = await getTripRole(proposal.tripId, session.user.id);
    const canUpdate = isCreator || role === 'owner' || role === 'organizer';

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'You do not have permission to update this proposal' },
        { status: 403 }
      );
    }

    // Cannot update if voting has started (unless only changing status)
    const body = await req.json();
    const validated = updateProposalSchema.parse(body);

    if (proposal.votes.length > 0) {
      // Only allow status changes if votes exist
      const allowedFields = ['status', 'votingDeadline'];
      const hasOtherChanges = Object.keys(validated).some(
        (key) => !allowedFields.includes(key)
      );

      if (hasOtherChanges) {
        return NextResponse.json(
          { error: 'Cannot update proposal details after voting has started' },
          { status: 400 }
        );
      }
    }

    // Update the proposal
    const updatedProposal = await prisma.proposal.update({
      where: { id: params.proposalId },
      data: {
        ...(validated.category && { category: validated.category }),
        ...(validated.title && { title: validated.title }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.url !== undefined && { url: validated.url }),
        ...(validated.price !== undefined && { price: validated.price }),
        ...(validated.currency && { currency: validated.currency }),
        ...(validated.startDate && { startDate: new Date(validated.startDate) }),
        ...(validated.endDate && { endDate: new Date(validated.endDate) }),
        ...(validated.location !== undefined && { location: validated.location }),
        ...(validated.status && { status: validated.status }),
        ...(validated.votingDeadline && {
          votingDeadline: new Date(validated.votingDeadline),
        }),
      },
      include: {
        proposedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        votes: true,
        _count: {
          select: {
            votes: true,
            comments: true,
          },
        },
      },
    });

    return NextResponse.json(updatedProposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to update proposal' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/proposals/[proposalId]
 * Delete a proposal
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the proposal
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check permissions: only creator or organizer/owner can delete
    const isCreator = proposal.proposedById === session.user.id;
    const role = await getTripRole(proposal.tripId, session.user.id);
    const canDelete = isCreator || role === 'owner' || role === 'organizer';

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this proposal' },
        { status: 403 }
      );
    }

    // Delete the proposal (cascade will delete votes and comments)
    await prisma.proposal.delete({
      where: { id: params.proposalId },
    });

    return NextResponse.json({ message: 'Proposal deleted successfully' });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    return NextResponse.json(
      { error: 'Failed to delete proposal' },
      { status: 500 }
    );
  }
}
