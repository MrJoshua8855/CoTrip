import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { canChangeRole, canRemoveMember, canManageMembers } from '@/lib/permissions';

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'organizer', 'member', 'viewer']),
  costPercentage: z.number().min(0).max(100).optional(),
});

// PUT /api/trips/[id]/members/[userId] - Update member role
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = updateMemberSchema.parse(body);

    // Check if user has permission to change roles
    const { canChange, reason } = await canChangeRole(
      session.user.id,
      params.id,
      params.userId,
      validated.role
    );

    if (!canChange) {
      return NextResponse.json({ error: reason }, { status: 403 });
    }

    // Update member
    const member = await prisma.tripMember.update({
      where: {
        tripId_userId: {
          tripId: params.id,
          userId: params.userId,
        },
      },
      data: {
        role: validated.role,
        costPercentage: validated.costPercentage,
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

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/trips/[id]/members/[userId] - Remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to remove members
    // Either the user is removing themselves, or they have manage_members permission
    const isSelfRemoval = session.user.id === params.userId;
    const hasPermission = await canManageMembers(session.user.id, params.id);

    if (!isSelfRemoval && !hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to remove members' },
        { status: 403 }
      );
    }

    // Check if member can be removed (not last owner)
    const { canRemove, reason } = await canRemoveMember(params.id, params.userId);

    if (!canRemove) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    // Remove member
    await prisma.tripMember.delete({
      where: {
        tripId_userId: {
          tripId: params.id,
          userId: params.userId,
        },
      },
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
