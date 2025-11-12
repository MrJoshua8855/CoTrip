# Proposal & Voting System Implementation Guide

## Overview
Implement a comprehensive proposal system for accommodations, activities, and other trip options with multiple voting mechanisms.

## Voting Types
1. **Single Choice**: One vote per user (yes/no or single selection)
2. **Ranked Choice**: Users rank their top 3 choices
3. **Approval**: Users can approve multiple options

## Implementation Steps

### Step 1: Create Proposal API Routes

#### File: `src/app/api/trips/[tripId]/proposals/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission } from '@/lib/permissions';

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
  metadata: z.any().optional(), // JSON for provider-specific data
  votingType: z.enum(['single', 'ranked', 'approval']).default('single'),
  votingDeadline: z.string().datetime().optional(),
});

// GET /api/trips/[tripId]/proposals
export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await checkTripPermission(
      params.tripId,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const proposals = await prisma.proposal.findMany({
      where: { tripId: params.tripId },
      include: {
        proposedBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        votes: {
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

// POST /api/trips/[tripId]/proposals
export async function POST(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await checkTripPermission(
      params.tripId,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = createProposalSchema.parse(body);

    const proposal = await prisma.proposal.create({
      data: {
        ...validated,
        tripId: params.tripId,
        proposedById: session.user.id,
      },
      include: {
        proposedBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Create notification for all trip members
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: params.tripId,
        userId: { not: session.user.id },
        status: 'active',
      },
    });

    await prisma.notification.createMany({
      data: members.map(member => ({
        userId: member.userId,
        tripId: params.tripId,
        type: 'new_proposal',
        title: 'New Proposal',
        message: `New ${validated.category} proposal: ${validated.title}`,
        data: { proposalId: proposal.id },
      })),
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating proposal:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}
```

### Step 2: Create Voting API Route

#### File: `src/app/api/proposals/[proposalId]/vote/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const voteSchema = z.object({
  voteValue: z.number().optional(), // For single choice: 1=yes, 0=no
  rankings: z.array(z.object({
    rank: z.number().min(1).max(3),
  })).optional(), // For ranked choice
});

// POST /api/proposals/[proposalId]/vote
export async function POST(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
      include: { trip: true },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if voting is still open
    if (proposal.status !== 'open') {
      return NextResponse.json({ error: 'Voting is closed' }, { status: 400 });
    }

    if (proposal.votingDeadline && new Date(proposal.votingDeadline) < new Date()) {
      return NextResponse.json({ error: 'Voting deadline passed' }, { status: 400 });
    }

    const body = await req.json();
    const validated = voteSchema.parse(body);

    if (proposal.votingType === 'ranked') {
      // Handle ranked choice voting
      if (!validated.rankings || validated.rankings.length === 0) {
        return NextResponse.json({ error: 'Rankings required' }, { status: 400 });
      }

      // Delete existing votes
      await prisma.vote.deleteMany({
        where: {
          proposalId: params.proposalId,
          userId: session.user.id,
        },
      });

      // Create new ranked votes
      await prisma.vote.createMany({
        data: validated.rankings.map(r => ({
          proposalId: params.proposalId,
          userId: session.user.id,
          rank: r.rank,
        })),
      });
    } else {
      // Handle single choice voting
      await prisma.vote.upsert({
        where: {
          proposalId_userId_rank: {
            proposalId: params.proposalId,
            userId: session.user.id,
            rank: null,
          },
        },
        update: {
          voteValue: validated.voteValue,
        },
        create: {
          proposalId: params.proposalId,
          userId: session.user.id,
          voteValue: validated.voteValue,
        },
      });
    }

    return NextResponse.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}

// GET /api/proposals/[proposalId]/vote - Get vote results
export async function GET(
  req: NextRequest,
  { params }: { params: { proposalId: string } }
) {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.proposalId },
      include: {
        votes: {
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

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Calculate vote results based on voting type
    let results;

    if (proposal.votingType === 'ranked') {
      // Ranked choice: calculate using instant runoff or Borda count
      results = calculateRankedResults(proposal.votes);
    } else {
      // Single choice: count yes/no
      const yes = proposal.votes.filter(v => v.voteValue === 1).length;
      const no = proposal.votes.filter(v => v.voteValue === 0).length;
      results = { yes, no, total: yes + no };
    }

    return NextResponse.json({
      proposal: {
        id: proposal.id,
        title: proposal.title,
        votingType: proposal.votingType,
        status: proposal.status,
      },
      results,
      votes: proposal.votes,
    });
  } catch (error) {
    console.error('Error fetching vote results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

function calculateRankedResults(votes: any[]) {
  // Group votes by user
  const userVotes = new Map<string, any[]>();

  votes.forEach(vote => {
    if (!userVotes.has(vote.userId)) {
      userVotes.set(vote.userId, []);
    }
    userVotes.get(vote.userId)!.push(vote);
  });

  // Calculate Borda count (rank 1 = 3 points, rank 2 = 2 points, rank 3 = 1 point)
  const scores = new Map<string, number>();

  userVotes.forEach(userVoteList => {
    userVoteList.forEach(vote => {
      const points = 4 - (vote.rank || 0); // rank 1 = 3, rank 2 = 2, rank 3 = 1
      const current = scores.get(vote.proposalId) || 0;
      scores.set(vote.proposalId, current + points);
    });
  });

  return {
    totalVoters: userVotes.size,
    scores: Object.fromEntries(scores),
  };
}
```

### Step 3: Create Proposal Components

#### File: `src/components/proposals/ProposalCard.tsx`
```typescript
'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { VoteButton } from './VoteButton';

interface ProposalCardProps {
  proposal: {
    id: string;
    title: string;
    description?: string;
    category: string;
    url?: string;
    price?: number;
    currency: string;
    votingType: string;
    status: string;
    proposedBy: {
      fullName: string;
      avatarUrl?: string;
    };
    votes: any[];
    _count: {
      votes: number;
      comments: number;
    };
  };
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const [showVoting, setShowVoting] = useState(false);

  const yesVotes = proposal.votes.filter(v => v.voteValue === 1).length;
  const noVotes = proposal.votes.filter(v => v.voteValue === 0).length;

  return (
    <div className="border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
            {proposal.category}
          </span>
          <h3 className="text-xl font-semibold mt-2">{proposal.title}</h3>
          <p className="text-sm text-gray-500">
            Proposed by {proposal.proposedBy.fullName}
          </p>
        </div>
        <span className={`px-3 py-1 rounded text-sm ${
          proposal.status === 'open' ? 'bg-green-100 text-green-800' :
          proposal.status === 'selected' ? 'bg-purple-100 text-purple-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {proposal.status}
        </span>
      </div>

      {proposal.description && (
        <p className="text-gray-600 mb-4">{proposal.description}</p>
      )}

      <div className="flex items-center gap-4 mb-4">
        {proposal.price && (
          <span className="text-lg font-semibold">
            {proposal.currency} {proposal.price}
          </span>
        )}
        {proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline"
          >
            View Details <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="flex items-center gap-6 pt-4 border-t">
        <button
          onClick={() => setShowVoting(!showVoting)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ThumbsUp size={18} />
          <span>{yesVotes}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ThumbsDown size={18} />
          <span>{noVotes}</span>
        </button>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <MessageSquare size={18} />
          <span>{proposal._count.comments}</span>
        </button>
      </div>

      {showVoting && proposal.status === 'open' && (
        <div className="mt-4 pt-4 border-t">
          <VoteButton proposalId={proposal.id} votingType={proposal.votingType} />
        </div>
      )}
    </div>
  );
}
```

### Step 4: Create Link Parser Utility

#### File: `src/lib/linkParser.ts`
```typescript
/**
 * Parse accommodation links and extract metadata
 */
export async function parseAccommodationLink(url: string) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.includes('airbnb')) {
      return await parseAirbnbLink(url);
    } else if (hostname.includes('vrbo')) {
      return await parseVrboLink(url);
    } else if (hostname.includes('booking')) {
      return await parseBookingLink(url);
    }

    return { provider: 'other', url };
  } catch (error) {
    return { provider: 'invalid', url };
  }
}

async function parseAirbnbLink(url: string) {
  // Extract listing ID from URL
  const match = url.match(/\/rooms\/(\d+)/);
  const listingId = match ? match[1] : null;

  return {
    provider: 'airbnb',
    url,
    listingId,
    // Additional metadata can be fetched via Airbnb API if available
  };
}

async function parseVrboLink(url: string) {
  // Similar parsing for VRBO
  return {
    provider: 'vrbo',
    url,
  };
}

async function parseBookingLink(url: string) {
  // Similar parsing for Booking.com
  return {
    provider: 'booking',
    url,
  };
}
```

## Voting Algorithms

### Single Choice
Simple majority wins. Count yes/no votes.

### Ranked Choice (Instant Runoff)
```typescript
function instantRunoffVoting(votes: Map<string, number[]>) {
  // Implementation of instant runoff voting
  // Eliminate lowest vote getter iteratively
  // Redistribute votes until winner emerges
}
```

### Borda Count (Simpler Alternative)
```typescript
function bordaCount(votes: any[]) {
  // Rank 1 = 3 points, Rank 2 = 2 points, Rank 3 = 1 point
  // Sum points for each option
  // Highest score wins
}
```

## Testing Checklist

- [ ] Create proposal with all fields
- [ ] Create proposal with minimum fields
- [ ] Single choice voting works
- [ ] Ranked choice voting works
- [ ] Vote results calculate correctly
- [ ] Voting deadline enforced
- [ ] Only trip members can vote
- [ ] Notifications sent on new proposals
- [ ] Comments on proposals work
- [ ] Link parser extracts metadata
- [ ] Proposal status transitions correctly

## Advanced Features

1. **Smart Scheduling**
   - Detect date conflicts
   - Suggest optimal times
   - Calendar integration

2. **Price Comparison**
   - Track price changes
   - Alert on price drops
   - Compare similar options

3. **Collaborative Filtering**
   - Suggest proposals based on preferences
   - Learn from past votes
   - Personalized recommendations

4. **Integration with Booking Platforms**
   - Direct booking from app
   - Real-time availability
   - Automatic price updates