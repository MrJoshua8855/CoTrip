# CoTrip - Project Implementation Roadmap

## Overview
CoTrip is a comprehensive group trip planning application designed to streamline the coordination of trips with multiple participants, featuring expense tracking, voting systems, and smart settlement calculations.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand
- **Real-time**: Socket.io or Pusher (optional)

## Development Phases

### Phase 1: Foundation ✅
- [x] Database schema design
- [x] Project setup and configuration
- [x] Folder structure
- [x] Environment configuration

### Phase 2: Core Authentication & User Management
- [ ] NextAuth.js configuration
- [ ] User registration and login
- [ ] Profile management
- [ ] Password reset functionality
- [ ] OAuth integration (Google, GitHub)

### Phase 3: Trip Management
- [ ] Trip CRUD operations
- [ ] Trip dashboard
- [ ] Member invitation system
- [ ] Role-based permissions (owner, organizer, member, viewer)
- [ ] Nested trips support

### Phase 4: Proposals & Voting System
- [ ] Proposal creation (accommodations, activities)
- [ ] Link parsing for VRBO/Airbnb/hotels
- [ ] Voting mechanisms:
  - Single choice voting
  - Ranked choice (top 3)
  - Approval voting
- [ ] Vote tallying and winner determination
- [ ] Voting deadlines and notifications

### Phase 5: Lists & Planning Tools
- [ ] Shared grocery lists
- [ ] Packing lists
- [ ] To-do lists
- [ ] Item assignment to users
- [ ] Cost tracking per item
- [ ] List categories and filtering

### Phase 6: Expense Tracking
- [ ] Expense entry and categorization
- [ ] Receipt upload functionality
- [ ] Multiple split types:
  - Equal split
  - Percentage-based
  - Custom amounts
  - Opt-in based
- [ ] Expense approval workflow
- [ ] Budget tracking and alerts

### Phase 7: Settlement Calculations
- [ ] Smart settlement algorithm
- [ ] Minimize number of transactions
- [ ] Balance calculation per user
- [ ] Settlement suggestions
- [ ] Payment tracking
- [ ] Export reports

### Phase 8: Real-time Features
- [ ] Live updates for votes
- [ ] Real-time expense updates
- [ ] Instant notifications
- [ ] Collaborative list editing
- [ ] Online presence indicators

### Phase 9: Additional Features
- [ ] Comments and discussions
- [ ] File attachments
- [ ] Trip timeline/itinerary
- [ ] Weather integration
- [ ] Map integration for locations
- [ ] Mobile responsiveness
- [ ] PWA support

## Key API Endpoints

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Trips
- `GET /api/trips` - List user's trips
- `POST /api/trips` - Create trip
- `GET /api/trips/[id]` - Get trip details
- `PUT /api/trips/[id]` - Update trip
- `DELETE /api/trips/[id]` - Delete trip

### Trip Members
- `GET /api/trips/[id]/members`
- `POST /api/trips/[id]/members` - Invite member
- `PUT /api/trips/[id]/members/[userId]` - Update member role
- `DELETE /api/trips/[id]/members/[userId]` - Remove member

### Proposals
- `GET /api/trips/[id]/proposals`
- `POST /api/trips/[id]/proposals`
- `PUT /api/proposals/[id]`
- `DELETE /api/proposals/[id]`
- `POST /api/proposals/[id]/vote`

### Expenses
- `GET /api/trips/[id]/expenses`
- `POST /api/trips/[id]/expenses`
- `PUT /api/expenses/[id]`
- `DELETE /api/expenses/[id]`
- `GET /api/trips/[id]/settlements`

### Lists
- `GET /api/trips/[id]/lists`
- `POST /api/trips/[id]/lists`
- `PUT /api/lists/[id]/items/[itemId]`
- `DELETE /api/lists/[id]/items/[itemId]`

## Settlement Algorithm

### Core Logic
1. Calculate each user's total expenses paid
2. Calculate each user's total share owed
3. Determine net balance (paid - owed)
4. Sort users by balance (creditors and debtors)
5. Match debtors with creditors to minimize transactions
6. Generate optimal settlement suggestions

### Example Implementation
```typescript
interface UserBalance {
  userId: string;
  paid: number;
  owed: number;
  balance: number;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

function calculateSettlements(expenses: Expense[]): Settlement[] {
  // 1. Calculate balances
  const balances = calculateUserBalances(expenses);

  // 2. Separate creditors and debtors
  const creditors = balances.filter(b => b.balance > 0);
  const debtors = balances.filter(b => b.balance < 0);

  // 3. Sort by absolute balance
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => a.balance - b.balance);

  // 4. Match and create settlements
  const settlements: Settlement[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.balance, Math.abs(debtor.balance));

    settlements.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: amount
    });

    creditor.balance -= amount;
    debtor.balance += amount;

    if (creditor.balance === 0) i++;
    if (debtor.balance === 0) j++;
  }

  return settlements;
}
```

## Component Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── trips/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── proposals/
│   │   │   │   ├── expenses/
│   │   │   │   ├── lists/
│   │   │   │   └── settings/
│   │   │   └── page.tsx
│   │   └── profile/
│   ├── api/
│   │   ├── auth/
│   │   ├── trips/
│   │   ├── proposals/
│   │   └── expenses/
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── trips/
│   ├── proposals/
│   ├── expenses/
│   └── shared/
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── utils.ts
│   └── validations/
├── hooks/
│   ├── use-trip.ts
│   ├── use-expenses.ts
│   └── use-settlements.ts
└── types/
    └── index.ts
```

## Security Considerations

1. **Authentication**: Implement secure session management with NextAuth
2. **Authorization**: Role-based access control for trip operations
3. **Input Validation**: Use Zod for schema validation
4. **SQL Injection**: Use Prisma's parameterized queries
5. **XSS Prevention**: Sanitize user inputs and use React's built-in protection
6. **Rate Limiting**: Implement API rate limiting
7. **File Upload**: Validate and sanitize file uploads
8. **HTTPS**: Enforce HTTPS in production

## Performance Optimizations

1. **Database Indexes**: Already defined in schema
2. **Query Optimization**: Use Prisma's include/select wisely
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Image Optimization**: Use Next.js Image component
5. **Code Splitting**: Leverage Next.js automatic code splitting
6. **Lazy Loading**: Implement for heavy components
7. **Pagination**: For lists and large datasets

## Testing Strategy

1. **Unit Tests**: Jest + React Testing Library
2. **Integration Tests**: API endpoint testing
3. **E2E Tests**: Playwright or Cypress
4. **Database Tests**: Test Prisma queries
5. **Settlement Algorithm**: Comprehensive test cases

## Deployment Considerations

1. **Hosting**: Vercel (frontend) + Railway/Render (database)
2. **CI/CD**: GitHub Actions
3. **Monitoring**: Sentry for error tracking
4. **Analytics**: Google Analytics or Plausible
5. **Backups**: Automated database backups
6. **Scaling**: Consider connection pooling for database

## Next Steps

1. Set up authentication system
2. Create base UI components
3. Implement trip CRUD operations
4. Build the proposal/voting system
5. Develop expense tracking
6. Implement settlement algorithm
7. Add real-time features
8. Deploy MVP
9. Gather user feedback
10. Iterate and improve