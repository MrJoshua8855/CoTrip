# CoTrip Implementation Guide

This guide provides detailed instructions for implementing the CoTrip application. Each section contains specific steps, code examples, and considerations for other agents to follow.

## Table of Contents
1. [Authentication System](./01-authentication.md)
2. [Trip Management](./02-trip-management.md)
3. [Proposal & Voting System](./03-proposals-voting.md)
4. [Expense Tracking](./04-expense-tracking.md)
5. [Settlement Algorithm](./05-settlement-algorithm.md)
6. [Lists & Planning Tools](./06-lists-planning.md)
7. [Real-time Features](./07-realtime-features.md)
8. [UI Components](./08-ui-components.md)
9. [API Specifications](./09-api-specifications.md)
10. [Testing Strategy](./10-testing-strategy.md)
11. [Deployment Guide](./11-deployment.md)

## Implementation Order

Follow this sequence for optimal development flow:

### Phase 1: Foundation (Week 1)
1. Set up Next.js project with TypeScript
2. Configure Prisma and database connection
3. Implement authentication system
4. Create base layout and navigation
5. Set up error handling and logging

### Phase 2: Core Features (Week 2-3)
1. Trip CRUD operations
2. Member management
3. Basic dashboard
4. User profiles
5. Notification system foundation

### Phase 3: Collaboration Features (Week 4-5)
1. Proposal creation and management
2. Voting mechanisms
3. Comments system
4. File uploads
5. Real-time updates setup

### Phase 4: Financial Features (Week 6-7)
1. Expense entry and tracking
2. Receipt management
3. Settlement calculations
4. Payment tracking
5. Reports and exports

### Phase 5: Additional Features (Week 8)
1. Lists (grocery, packing, etc.)
2. Opt-in features
3. Nested trips
4. Search and filtering
5. Mobile optimization

### Phase 6: Polish & Launch (Week 9-10)
1. Performance optimization
2. Security audit
3. Testing suite completion
4. Documentation
5. Deployment

## Key Principles

### 1. Security First
- Always validate input on both client and server
- Use parameterized queries (Prisma handles this)
- Implement proper authentication checks
- Follow OWASP guidelines

### 2. User Experience
- Optimistic updates for better perceived performance
- Clear loading states
- Comprehensive error messages
- Mobile-first responsive design

### 3. Code Quality
- TypeScript for type safety
- Consistent naming conventions
- Component composition over inheritance
- Separate business logic from UI

### 4. Performance
- Implement pagination for lists
- Use React Query for caching
- Optimize images with Next.js Image
- Lazy load heavy components

### 5. Scalability
- Design for horizontal scaling
- Use connection pooling
- Implement caching strategy
- Consider microservices for future

## Development Environment Setup

```bash
# 1. Clone repository
git clone [repository-url]
cd cotrip

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Set up database
npx prisma generate
npx prisma db push

# 5. Run development server
npm run dev
```

## Project Structure

```
cotrip/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                 # Utilities and configurations
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Helper functions
│   └── styles/             # Global styles
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Database seeding
├── public/                 # Static assets
└── tests/                  # Test files
```

## Common Patterns

### API Route Pattern
```typescript
// src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  // Define validation schema
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate input
    const body = await req.json();
    const validated = schema.parse(body);

    // 3. Business logic
    const result = await performOperation(validated);

    // 4. Return response
    return NextResponse.json(result);
  } catch (error) {
    // 5. Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### Component Pattern
```typescript
// src/components/feature/Component.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

interface ComponentProps {
  // Define props
}

export function Component({ ...props }: ComponentProps) {
  // 1. State management
  const [state, setState] = useState();

  // 2. Data fetching
  const { data, isLoading, error } = useQuery({
    queryKey: ['resource'],
    queryFn: fetchResource,
  });

  // 3. Mutations
  const mutation = useMutation({
    mutationFn: updateResource,
    onSuccess: () => {
      // Handle success
    },
  });

  // 4. Effects
  useEffect(() => {
    // Side effects
  }, []);

  // 5. Render
  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Hook Pattern
```typescript
// src/hooks/useResource.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useResource(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['resource', id],
    queryFn: () => fetchResource(id),
  });

  const updateMutation = useMutation({
    mutationFn: updateResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource', id] });
    },
  });

  return {
    ...query,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
```

## Error Handling Strategy

### Client-Side
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage
try {
  await apiCall();
} catch (error) {
  if (error instanceof AppError) {
    toast.error(error.message);
  } else {
    toast.error('An unexpected error occurred');
    console.error(error);
  }
}
```

### Server-Side
```typescript
// lib/errors.ts
export class ValidationError extends Error {
  statusCode = 400;
}

export class AuthenticationError extends Error {
  statusCode = 401;
}

export class AuthorizationError extends Error {
  statusCode = 403;
}

export class NotFoundError extends Error {
  statusCode = 404;
}

// API Route
try {
  // ... operation
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  // ... handle other errors
}
```

## State Management Strategy

### Global State (Zustand)
```typescript
// stores/tripStore.ts
import { create } from 'zustand';

interface TripStore {
  currentTrip: Trip | null;
  setCurrentTrip: (trip: Trip) => void;
  members: TripMember[];
  setMembers: (members: TripMember[]) => void;
}

export const useTripStore = create<TripStore>((set) => ({
  currentTrip: null,
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  members: [],
  setMembers: (members) => set({ members }),
}));
```

### Server State (React Query)
```typescript
// queries/trips.ts
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters: string) => [...tripKeys.lists(), { filters }] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
};

export function useTrip(id: string) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => fetchTrip(id),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

## Database Optimization Tips

1. **Indexes**: Already defined in schema
2. **Query Optimization**: Use Prisma's `select` and `include` wisely
3. **Pagination**: Always paginate large lists
4. **N+1 Prevention**: Use proper joins
5. **Connection Pooling**: Configure in production

## Security Checklist

- [ ] Authentication on all protected routes
- [ ] Authorization checks for resource access
- [ ] Input validation with Zod
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (React handles, but be careful with dangerouslySetInnerHTML)
- [ ] CSRF protection (NextAuth handles)
- [ ] Rate limiting on API routes
- [ ] Secure file upload validation
- [ ] Environment variables for secrets
- [ ] HTTPS in production
- [ ] Security headers configuration

## Performance Checklist

- [ ] Image optimization with Next.js Image
- [ ] Code splitting (automatic in Next.js)
- [ ] Lazy loading for heavy components
- [ ] Debouncing for search inputs
- [ ] Virtualization for long lists
- [ ] Caching strategy with React Query
- [ ] Database query optimization
- [ ] CDN for static assets
- [ ] Compression enabled
- [ ] Bundle size monitoring

## Monitoring & Logging

### Error Tracking (Sentry)
```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

export function logError(error: Error, context?: any) {
  console.error(error);
  Sentry.captureException(error, {
    extra: context,
  });
}
```

### Analytics
```typescript
// lib/analytics.ts
export function trackEvent(event: string, properties?: any) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, properties);
  }
}
```

## Notes for Implementers

1. **Start with authentication** - Everything builds on this
2. **Use TypeScript strictly** - It prevents many bugs
3. **Write tests as you go** - Don't leave them for later
4. **Document API endpoints** - Use tools like Swagger
5. **Keep components small** - Single responsibility principle
6. **Optimize early** - But don't over-optimize
7. **Handle errors gracefully** - Users should never see stack traces
8. **Make it accessible** - Use semantic HTML and ARIA labels
9. **Test on mobile** - Many users will be mobile-first
10. **Get feedback early** - Deploy MVP and iterate