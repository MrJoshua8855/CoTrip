import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission } from '@/lib/permissions';
import {
  calculateSingleChoice,
  calculateBordaCount,
  calculateApprovalVoting,
  isVotingClosed,
} from '@/lib/voting';

// Validation schemas for different voting types
const singleChoiceVoteSchema = z.object({
  voteValue: z.number().int().min(0).max(1), // 0 = no, 1 = yes
});

const rankedChoiceVoteSchema = z.object({
  proposalIds: z.array(z.string()).min(1).max(3), // Array of proposal IDs ranked 1-3
});

const approvalVotingSchema = z.object({
  proposalIds: z.array(z.string()).min(1), // Array of approved proposal IDs
});

/**
 * POST /api/proposals/[proposalId]/vote
 * Submit or update a vote
 */
export async function POST(
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
        trip: {
          select: {
            id: true,
            members: {
              where: { status: 'active' },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if user is a trip member
    const isMember = proposal.trip.members.some(
      (m) => m.userId === session.user.id
    );

    if (!isMember) {
      return NextResponse.json(
        { error: 'You must be a trip member to vote' },
        { status: 403 }
      );
    }

    // Check if voting is still open
    if (proposal.status !== 'open') {
      return NextResponse.json(
        { error: 'Voting is closed for this proposal' },
        { status: 400 }
      );
    }

    // Check if voting deadline has passed
    if (proposal.votingDeadline && isVotingClosed(proposal.votingDeadline)) {
      return NextResponse.json(
        { error: 'Voting deadline has passed' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Handle different voting types
    if (proposal.votingType === 'single') {
      return await handleSingleChoiceVote(
        params.proposalId,
        session.user.id,
        body
      );
    } else if (proposal.votingType === 'ranked') {
      return await handleRankedChoiceVote(
        proposal.tripId,
        proposal.category,
        session.user.id,
        body
      );
    } else if (proposal.votingType === 'approval') {
      return await handleApprovalVote(
        proposal.tripId,
        proposal.category,
        session.user.id,
        body
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid voting type' },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}

/**
 * Handle single choice voting (yes/no)
 */
async function handleSingleChoiceVote(
  proposalId: string,
  userId: string,
  body: any
) {
  const validated = singleChoiceVoteSchema.parse(body);

  // Delete existing vote if any
  await prisma.vote.deleteMany({
    where: {
      proposalId,
      userId,
    },
  });

  // Create new vote
  const vote = await prisma.vote.create({
    data: {
      proposalId,
      userId,
      voteValue: validated.voteValue,
    },
  });

  return NextResponse.json({
    message: 'Vote recorded successfully',
    vote,
  });
}

/**
 * Handle ranked choice voting
 * User ranks multiple proposals (1st, 2nd, 3rd choice)
 */
async function handleRankedChoiceVote(
  tripId: string,
  category: string,
  userId: string,
  body: any
) {
  const validated = rankedChoiceVoteSchema.parse(body);

  // Get all open proposals in the same category for this trip
  const proposals = await prisma.proposal.findMany({
    where: {
      tripId,
      category,
      status: 'open',
      id: { in: validated.proposalIds },
    },
  });

  if (proposals.length !== validated.proposalIds.length) {
    return NextResponse.json(
      { error: 'One or more proposals not found or not eligible for voting' },
      { status: 400 }
    );
  }

  // Delete existing ranked votes for this category
  await prisma.vote.deleteMany({
    where: {
      userId,
      proposal: {
        tripId,
        category,
        status: 'open',
      },
      rank: { not: null },
    },
  });

  // Create new ranked votes
  const votes = await prisma.$transaction(
    validated.proposalIds.map((proposalId, index) =>
      prisma.vote.create({
        data: {
          proposalId,
          userId,
          rank: index + 1, // 1st, 2nd, 3rd
        },
      })
    )
  );

  return NextResponse.json({
    message: 'Rankings recorded successfully',
    votes,
  });
}

/**
 * Handle approval voting
 * User can approve multiple proposals
 */
async function handleApprovalVote(
  tripId: string,
  category: string,
  userId: string,
  body: any
) {
  const validated = approvalVotingSchema.parse(body);

  // Get all open proposals in the same category for this trip
  const proposals = await prisma.proposal.findMany({
    where: {
      tripId,
      category,
      status: 'open',
      id: { in: validated.proposalIds },
    },
  });

  if (proposals.length !== validated.proposalIds.length) {
    return NextResponse.json(
      { error: 'One or more proposals not found or not eligible for voting' },
      { status: 400 }
    );
  }

  // Delete existing approval votes for this category
  await prisma.vote.deleteMany({
    where: {
      userId,
      proposal: {
        tripId,
        category,
        status: 'open',
      },
    },
  });

  // Create new approval votes (voteValue = 1 for approved)
  const votes = await prisma.$transaction(
    validated.proposalIds.map((proposalId) =>
      prisma.vote.create({
        data: {
          proposalId,
          userId,
          voteValue: 1,
        },
      })
    )
  );

  return NextResponse.json({
    message: 'Approvals recorded successfully',
    votes,
  });
}

/**
 * GET /api/proposals/[proposalId]/vote
 * Get vote results for a proposal
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

    // Fetch the proposal with votes
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
      include: {
        trip: {
          select: {
            id: true,
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
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if user has access to view this trip
    const hasAccess = await checkTripPermission(
      proposal.trip.id,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all proposals in the same category for ranked/approval voting
    let allProposals = [proposal];
    if (proposal.votingType === 'ranked' || proposal.votingType === 'approval') {
      allProposals = await prisma.proposal.findMany({
        where: {
          tripId: proposal.tripId,
          category: proposal.category,
          status: 'open',
        },
        include: {
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
        },
      });
    }

    const totalMembers = proposal.trip.members.length;

    // Calculate results based on voting type
    let results;
    if (proposal.votingType === 'single') {
      results = calculateSingleChoice(proposal, totalMembers);
    } else if (proposal.votingType === 'ranked') {
      const rankedResults = calculateBordaCount(allProposals);
      results = rankedResults;
    } else if (proposal.votingType === 'approval') {
      const approvalResults = calculateApprovalVoting(allProposals, totalMembers);
      results = approvalResults;
    }

    return NextResponse.json({
      proposal: {
        id: proposal.id,
        title: proposal.title,
        votingType: proposal.votingType,
        status: proposal.status,
        votingDeadline: proposal.votingDeadline,
      },
      results,
      totalMembers,
      votingClosed: isVotingClosed(proposal.votingDeadline),
    });
  } catch (error) {
    console.error('Error fetching vote results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote results' },
      { status: 500 }
    );
  }
}
