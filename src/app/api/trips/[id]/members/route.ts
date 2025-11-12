import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkTripPermission } from '@/lib/permissions';
import { sendInvitationEmail } from '@/lib/email';

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['organizer', 'member', 'viewer']).default('member'),
});

// GET /api/trips/[id]/members - Get trip members
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await checkTripPermission(
      params.id,
      session.user.id,
      'view'
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const members = await prisma.tripMember.findMany({
      where: { tripId: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// POST /api/trips/[id]/members - Invite new member
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to invite
    const hasPermission = await checkTripPermission(
      params.id,
      session.user.id,
      'invite'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = inviteMemberSchema.parse(body);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      // Create placeholder user (will complete registration later)
      const username = validated.email.split('@')[0];
      const timestamp = Date.now();
      user = await prisma.user.create({
        data: {
          email: validated.email,
          username: username + '_' + timestamp,
          passwordHash: '',
        },
      });
    }

    // Check if already a member
    const existingMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: params.id,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 400 }
      );
    }

    // Add member to trip
    const member = await prisma.tripMember.create({
      data: {
        tripId: params.id,
        userId: user.id,
        role: validated.role,
        status: 'invited',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Send invitation email/notification
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { name: true },
    });

    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, email: true },
    });

    await sendInvitationEmail(user.email, {
      tripName: trip!.name,
      invitedBy: inviter?.fullName || inviter?.email || 'Someone',
      tripId: params.id,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error inviting member:', error);
    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    );
  }
}
