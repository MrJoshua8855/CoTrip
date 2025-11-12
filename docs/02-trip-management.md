# Trip Management Implementation Guide

## Overview
Implement comprehensive trip management including CRUD operations, member management, nested trips, and role-based permissions.

## Core Features
- Trip creation, editing, deletion
- Member invitation and management
- Role-based access control (owner, organizer, member, viewer)
- Nested trips (trips within trips)
- Trip status management
- Cost structure configuration

## Step-by-Step Implementation

### Step 1: Create Trip API Routes

#### File: `src/app/api/trips/route.ts` (GET all trips, POST new trip)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createTripSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  destination: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  parentTripId: z.string().optional(),
  costStructure: z.enum(['per_trip', 'per_user', 'custom']).optional(),
  totalBudget: z.number().optional(),
  currency: z.string().default('USD'),
});

// GET /api/trips - Get all trips for current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trips = await prisma.trip.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
            status: 'active',
          },
        },
      },
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
        _count: {
          select: {
            proposals: true,
            expenses: true,
            listItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trips' },
      { status: 500 }
    );
  }
}

// POST /api/trips - Create new trip
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = createTripSchema.parse(body);

    // Create trip and add creator as owner
    const trip = await prisma.trip.create({
      data: {
        ...validated,
        createdById: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: 'owner',
            status: 'active',
          },
        },
      },
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

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating trip:', error);
    return NextResponse.json(
      { error: 'Failed to create trip' },
      { status: 500 }
    );
  }
}
```

#### File: `src/app/api/trips/[id]/route.ts` (GET, PUT, DELETE single trip)
```typescript
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
    if (!session?.user) {
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
        parentTrip: true,
        subTrips: true,
        proposals: {
          where: { status: 'open' },
          take: 5,
          orderBy: { createdAt: 'desc' },
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
    if (!session?.user) {
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

    const trip = await prisma.trip.update({
      where: { id: params.id },
      data: validated,
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
    if (!session?.user) {
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
```

### Step 2: Create Member Management Routes

#### File: `src/app/api/trips/[id]/members/route.ts`
```typescript
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
    if (!session?.user) {
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
    if (!session?.user) {
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
      user = await prisma.user.create({
        data: {
          email: validated.email,
          username: validated.email.split('@')[0],
          passwordHash: '', // Will be set during registration
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

    // Send invitation email
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { name: true },
    });

    await sendInvitationEmail(user.email, {
      tripName: trip!.name,
      invitedBy: session.user.name || session.user.email!,
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
```

### Step 3: Create Permission Helper

#### File: `src/lib/permissions.ts`
```typescript
import { prisma } from '@/lib/db';

type Permission = 'view' | 'edit' | 'delete' | 'invite' | 'manage_members';

const rolePermissions: Record<string, Permission[]> = {
  owner: ['view', 'edit', 'delete', 'invite', 'manage_members'],
  organizer: ['view', 'edit', 'invite'],
  member: ['view'],
  viewer: ['view'],
};

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

  const permissions = rolePermissions[member.role] || [];
  return permissions.includes(permission);
}

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
```

### Step 4: Create Trip Dashboard Page

#### File: `src/app/trips/page.tsx`
```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Calendar, Users, DollarSign } from 'lucide-react';
import { CreateTripDialog } from '@/components/trips/CreateTripDialog';
import { TripCard } from '@/components/trips/TripCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function TripsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const response = await fetch('/api/trips');
      if (!response.ok) throw new Error('Failed to fetch trips');
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading trips</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Trips</h1>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} />
          New Trip
        </button>
      </div>

      {trips?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No trips yet</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="text-blue-500 hover:underline"
          >
            Create your first trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips?.map((trip: any) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      <CreateTripDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
```

### Step 5: Create Trip Detail Page

#### File: `src/app/trips/[id]/page.tsx`
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TripOverview } from '@/components/trips/TripOverview';
import { TripMembers } from '@/components/trips/TripMembers';
import { TripProposals } from '@/components/trips/TripProposals';
import { TripExpenses } from '@/components/trips/TripExpenses';
import { TripLists } from '@/components/trips/TripLists';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;

  const { data: trip, isLoading, error } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) throw new Error('Failed to fetch trip');
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading trip</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{trip.name}</h1>
        {trip.description && (
          <p className="text-gray-600">{trip.description}</p>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TripOverview trip={trip} />
        </TabsContent>

        <TabsContent value="members">
          <TripMembers tripId={tripId} />
        </TabsContent>

        <TabsContent value="proposals">
          <TripProposals tripId={tripId} />
        </TabsContent>

        <TabsContent value="expenses">
          <TripExpenses tripId={tripId} />
        </TabsContent>

        <TabsContent value="lists">
          <TripLists tripId={tripId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 6: Create Trip Components

#### File: `src/components/trips/TripCard.tsx`
```typescript
import Link from 'next/link';
import { Calendar, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface TripCardProps {
  trip: {
    id: string;
    name: string;
    description?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    members: any[];
    _count: {
      proposals: number;
      expenses: number;
    };
  };
}

export function TripCard({ trip }: TripCardProps) {
  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <h3 className="text-xl font-semibold mb-2">{trip.name}</h3>

        {trip.destination && (
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <MapPin size={16} />
            <span>{trip.destination}</span>
          </div>
        )}

        {trip.startDate && (
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Calendar size={16} />
            <span>
              {format(new Date(trip.startDate), 'MMM d')}
              {trip.endDate && ` - ${format(new Date(trip.endDate), 'MMM d, yyyy')}`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600 mb-4">
          <Users size={16} />
          <span>{trip.members.length} members</span>
        </div>

        <div className="flex justify-between text-sm text-gray-500">
          <span>{trip._count.proposals} proposals</span>
          <span>{trip._count.expenses} expenses</span>
        </div>
      </div>
    </Link>
  );
}
```

## Testing Checklist

### Trip Management
- [ ] User can create a new trip
- [ ] Trip appears in user's trip list
- [ ] User can view trip details
- [ ] User can edit trip (with permission)
- [ ] User can delete trip (if owner)
- [ ] Nested trips work correctly

### Member Management
- [ ] Owner can invite members
- [ ] Members receive invitation email
- [ ] Members can accept/decline invitations
- [ ] Role-based permissions work correctly
- [ ] Members can be removed (with permission)
- [ ] Member list displays correctly

### Permissions
- [ ] Owners have full access
- [ ] Organizers can edit but not delete
- [ ] Members have read-only access
- [ ] Viewers have limited read access
- [ ] Non-members cannot access trip

## Common Issues & Solutions

### Issue: Member invitation fails
**Solution**: Check email service configuration

### Issue: Permission denied errors
**Solution**: Verify role assignments in database

### Issue: Trip not appearing for members
**Solution**: Check member status (should be 'active')

### Issue: Nested trips not working
**Solution**: Ensure parent_trip_id foreign key is set correctly

## Advanced Features to Consider

1. **Trip Templates**
   - Save common trip configurations
   - Quick setup for recurring trips

2. **Trip Cloning**
   - Duplicate existing trip structure
   - Useful for annual events

3. **Archive System**
   - Archive completed trips
   - Keep data but remove from active list

4. **Trip Analytics**
   - Member participation metrics
   - Cost analysis
   - Activity trends

5. **Export/Import**
   - Export trip data
   - Import from other platforms
   - Backup functionality