# Prompt to Launch Parallel Implementation Agents

## Copy and paste this entire prompt into Claude Code Web:

---

I have a comprehensive plan for building a group trip planning application called CoTrip. The full documentation is in the `/docs` folder with implementation guides, API specifications, and database schemas already created.

Please launch 5 parallel agents to implement different parts of this application simultaneously. Each agent should work independently on their assigned module following the existing documentation.

**Project location**: `/mnt/c/Code Projects/CoTrip`
**Tech stack**: Next.js 14, React 18, TypeScript, PostgreSQL, Prisma, NextAuth.js, Tailwind CSS

## Agent Tasks:

### Agent 1: Core Setup & Authentication
- Set up the Next.js project structure based on existing config files
- Implement the Prisma database client (`src/lib/db.ts`)
- Implement complete authentication system following `/docs/01-authentication.md`:
  - NextAuth configuration (`src/lib/auth.ts`)
  - Auth API routes (`src/app/api/auth/[...nextauth]/route.ts`)
  - Registration endpoint (`src/app/api/auth/register/route.ts`)
  - Login page (`src/app/auth/login/page.tsx`)
  - Register page (`src/app/auth/register/page.tsx`)
  - Session provider (`src/app/providers.tsx`)
  - Middleware for route protection (`src/middleware.ts`)
  - Auth hooks (`src/hooks/useAuth.ts`)
- Create base layout with navigation (`src/app/layout.tsx`)
- Set up error boundary and loading states

### Agent 2: Trip Management & Members
- Implement trip management following `/docs/02-trip-management.md`:
  - Trip API routes (`src/app/api/trips/route.ts`, `src/app/api/trips/[id]/route.ts`)
  - Member management routes (`src/app/api/trips/[id]/members/route.ts`)
  - Permission system (`src/lib/permissions.ts`)
  - Trip list page (`src/app/trips/page.tsx`)
  - Trip detail page (`src/app/trips/[id]/page.tsx`)
- Create trip components:
  - TripCard (`src/components/trips/TripCard.tsx`)
  - CreateTripDialog (`src/components/trips/CreateTripDialog.tsx`)
  - TripOverview (`src/components/trips/TripOverview.tsx`)
  - TripMembers (`src/components/trips/TripMembers.tsx`)
- Implement member invitation system with email notifications
- Add support for nested trips (parent_trip_id)

### Agent 3: Proposals & Voting System
- Implement proposal system following `/docs/03-proposals-voting.md`:
  - Proposal API routes (`src/app/api/trips/[tripId]/proposals/route.ts`)
  - Voting endpoints (`src/app/api/proposals/[proposalId]/vote/route.ts`)
  - Link parser utility (`src/lib/linkParser.ts`) for Airbnb/VRBO/Booking
- Implement voting algorithms:
  - Single choice voting
  - Ranked choice with Borda count
  - Approval voting
- Create proposal components:
  - ProposalCard (`src/components/proposals/ProposalCard.tsx`)
  - ProposalForm (`src/components/proposals/ProposalForm.tsx`)
  - VoteButton (`src/components/proposals/VoteButton.tsx`)
  - TripProposals (`src/components/trips/TripProposals.tsx`)
- Add voting deadline enforcement
- Implement vote result calculations

### Agent 4: Expense Tracking & Settlements
- Implement expense system following `/docs/04-expense-tracking.md`:
  - Expense API routes (`src/app/api/trips/[tripId]/expenses/route.ts`)
  - Split calculation utilities (`src/lib/expenses.ts`)
  - Receipt upload functionality (`src/lib/upload.ts`)
- Implement settlement algorithm following `/docs/05-settlement-algorithm.md`:
  - Settlement calculations (`src/lib/settlements.ts`)
  - Settlement API routes (`src/app/api/trips/[tripId]/settlements/route.ts`)
  - Optimal transaction minimization algorithm
- Create expense components:
  - ExpenseForm (`src/components/expenses/ExpenseForm.tsx`)
  - ExpenseList (`src/components/expenses/ExpenseList.tsx`)
  - TripExpenses (`src/components/trips/TripExpenses.tsx`)
- Create settlement components:
  - SettlementView (`src/components/settlements/SettlementView.tsx`)
  - BalanceDisplay (`src/components/settlements/BalanceDisplay.tsx`)
- Implement all 4 split types: equal, percentage, amount, opt-in

### Agent 5: UI Components & Additional Features
- Create shared UI components using shadcn/ui:
  - Button, Card, Dialog, Tabs, Form components
  - LoadingSpinner (`src/components/ui/LoadingSpinner.tsx`)
  - Toast notifications setup
- Implement list management:
  - List API routes (`src/app/api/trips/[tripId]/lists/route.ts`)
  - GroceryList (`src/components/lists/GroceryList.tsx`)
  - PackingList (`src/components/lists/PackingList.tsx`)
  - TripLists (`src/components/trips/TripLists.tsx`)
- Create notification system:
  - Notification API routes (`src/app/api/notifications/route.ts`)
  - NotificationBell component
  - Real-time notification updates
- Implement comments:
  - Comment API routes
  - Comment components
- Create homepage (`src/app/page.tsx`)
- Add responsive design for mobile
- Implement dark mode support

## Important Instructions for All Agents:

1. **Follow the existing documentation** in `/docs` folder strictly
2. **Use the database schema** defined in `prisma/schema.prisma`
3. **Reference the API specifications** in `/docs/API_REFERENCE.md`
4. **Use TypeScript strictly** - no `any` types unless absolutely necessary
5. **Include error handling** in all API routes and components
6. **Add loading states** for all async operations
7. **Implement input validation** using Zod schemas
8. **Follow the security checklist** from documentation
9. **Use the existing file structure** - don't create new folders unless specified
10. **Test your implementation** against the test scenarios in the guides

## Coordination Notes:

- All agents can work independently as modules are well-separated
- Database schema is already defined, so no conflicts there
- API routes follow RESTful conventions from the API reference
- Use the types from Prisma generated client
- Components should be modular and reusable
- Follow the patterns shown in the implementation guides

## Expected Deliverables:

Each agent should produce working code that:
- Follows the documentation exactly
- Includes proper error handling
- Has loading and error states
- Is fully typed with TypeScript
- Validates all inputs
- Handles edge cases
- Is ready for testing

Start implementing your assigned module following the comprehensive guides provided. Work independently and efficiently.

---

## To execute this in Claude Code Web:

1. Copy the entire prompt above
2. Paste it into Claude Code Web
3. Claude will automatically launch 5 parallel agents
4. Each agent will work on their assigned module
5. You'll see progress from all agents simultaneously
6. The implementation will follow the detailed guides we created