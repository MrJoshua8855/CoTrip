import { prisma } from '@/lib/db';
import { Trip, TripMember } from '@prisma/client';

export type Permission = 'view' | 'edit' | 'delete' | 'invite' | 'manage_members' | 'create_proposal' | 'create_expense';

export type Role = 'owner' | 'organizer' | 'member' | 'viewer';

// Define role hierarchy and permissions
const rolePermissions: Record<Role, Permission[]> = {
  owner: ['view', 'edit', 'delete', 'invite', 'manage_members', 'create_proposal', 'create_expense'],
  organizer: ['view', 'edit', 'invite', 'create_proposal', 'create_expense'],
  member: ['view', 'create_proposal', 'create_expense'],
  viewer: ['view'],
};

/**
 * Check if a user has a specific permission for a trip
 */
export async function checkTripPermission(
  tripId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  const member = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
  });

  if (!member || member.status !== 'active') {
    return false;
  }

  const permissions = rolePermissions[member.role as Role] || [];
  return permissions.includes(permission);
}

/**
 * Get user's role in a trip
 */
export async function getTripRole(
  tripId: string,
  userId: string
): Promise<string | null> {
  const member = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
  });

  return member?.role || null;
}

/**
 * Check if user can edit trip
 */
export async function canEditTrip(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'edit');
}

/**
 * Check if user can delete trip
 */
export async function canDeleteTrip(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'delete');
}

/**
 * Check if user can invite members
 */
export async function canInviteMembers(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'invite');
}

/**
 * Check if user can manage members (change roles, remove members)
 */
export async function canManageMembers(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'manage_members');
}

/**
 * Check if user can create proposals
 */
export async function canCreateProposal(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'create_proposal');
}

/**
 * Check if user can create expenses
 */
export async function canCreateExpense(userId: string, tripId: string): Promise<boolean> {
  return checkTripPermission(tripId, userId, 'create_expense');
}

/**
 * Check if user is owner of the trip
 */
export async function isOwner(userId: string, tripId: string): Promise<boolean> {
  const role = await getTripRole(tripId, userId);
  return role === 'owner';
}

/**
 * Get number of owners in a trip
 */
export async function getOwnerCount(tripId: string): Promise<number> {
  return prisma.tripMember.count({
    where: {
      tripId,
      role: 'owner',
      status: 'active',
    },
  });
}

/**
 * Check if a member can be removed (cannot remove last owner)
 */
export async function canRemoveMember(
  tripId: string,
  memberToRemoveId: string
): Promise<{ canRemove: boolean; reason?: string }> {
  const member = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId: memberToRemoveId,
      },
    },
  });

  if (!member) {
    return { canRemove: false, reason: 'Member not found' };
  }

  // Check if this is the last owner
  if (member.role === 'owner') {
    const ownerCount = await getOwnerCount(tripId);
    if (ownerCount <= 1) {
      return { canRemove: false, reason: 'Cannot remove the last owner' };
    }
  }

  return { canRemove: true };
}

/**
 * Check if a user can change another member's role
 */
export async function canChangeRole(
  requestorId: string,
  tripId: string,
  targetMemberId: string,
  newRole: Role
): Promise<{ canChange: boolean; reason?: string }> {
  const requestorRole = await getTripRole(tripId, requestorId);
  const targetMember = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId: targetMemberId,
      },
    },
  });

  if (!requestorRole || !targetMember) {
    return { canChange: false, reason: 'Member not found' };
  }

  // Only owners can change roles
  if (requestorRole !== 'owner') {
    return { canChange: false, reason: 'Only owners can change member roles' };
  }

  // If demoting from owner, check owner count
  if (targetMember.role === 'owner' && newRole !== 'owner') {
    const ownerCount = await getOwnerCount(tripId);
    if (ownerCount <= 1) {
      return { canChange: false, reason: 'Cannot demote the last owner' };
    }
  }

  return { canChange: true };
}
