import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission, canCreateProposal } from '@/lib/permissions';
import { parseAccommodationLink } from '@/lib/linkParser';

// Validation schema for creating a proposal
const createProposalSchema = z.object({
  category: z.enum(['accommodation', 'activity', 'transportation', 'dining', 'other']),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  url: z.string().url().optional(),
  price: z.number().optional(),
  currency: z.string().default('USD'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  votingType: z.enum(['single', 'ranked', 'approval']).default('single'),
  votingDeadline: z.string().datetime().optional(),
});

/**
 * GET /api/trips/[tripId]/proposals
 * List all proposals for a trip with filters
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to view this trip
    const hasAccess = await checkTripPermission(
      params.tripId,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters for filtering
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Build where clause
    const where: any = {
      tripId: params.tripId,
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    // Fetch proposals with related data
    const proposals = await prisma.proposal.findMany({
      where,
      include: {
        proposedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
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
        _count: {
          select: {
            votes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/[tripId]/proposals
 * Create a new proposal
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can create proposals in this trip
    const canCreate = await canCreateProposal(session.user.id, params.tripId);
    if (!canCreate) {
      return NextResponse.json(
        { error: 'You do not have permission to create proposals in this trip' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createProposalSchema.parse(body);

    // Parse link metadata if URL is provided
    let metadata: any = {};
    if (validated.url) {
      try {
        const linkData = await parseAccommodationLink(validated.url);
        metadata.linkData = linkData;

        // Auto-fill fields if not provided
        if (!validated.title && linkData.title) {
          validated.title = linkData.title;
        }
        if (!validated.price && linkData.price) {
          validated.price = linkData.price;
        }
        if (!validated.location && linkData.location) {
          validated.location = linkData.location;
        }
      } catch (linkError) {
        console.warn('Failed to parse link:', linkError);
        // Continue without link metadata
      }
    }

    // Create the proposal
    const proposal = await prisma.proposal.create({
      data: {
        tripId: params.tripId,
        proposedById: session.user.id,
        category: validated.category,
        title: validated.title,
        description: validated.description,
        url: validated.url,
        price: validated.price,
        currency: validated.currency,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        location: validated.location,
        metadata,
        votingType: validated.votingType,
        votingDeadline: validated.votingDeadline
          ? new Date(validated.votingDeadline)
          : null,
        status: 'open',
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

    // Create notifications for all trip members (except the creator)
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: params.tripId,
        userId: { not: session.user.id },
        status: 'active',
      },
    });

    if (members.length > 0) {
      await prisma.notification.createMany({
        data: members.map((member) => ({
          userId: member.userId,
          tripId: params.tripId,
          type: 'new_proposal',
          title: 'New Proposal',
          message: `${session.user.name || 'A member'} added a new ${validated.category} proposal: ${validated.title}`,
          data: { proposalId: proposal.id },
        })),
      });
    }

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}
