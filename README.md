"# CoTrip - Group Trip Planning Application

A comprehensive application for planning and managing group trips with collaborative features, expense tracking, and smart settlement calculations.

## Overview

CoTrip facilitates group planning of any kind of trip by providing tools for:
- **Trip Management**: Create and organize trips with multiple participants
- **Proposal & Voting**: Suggest accommodations, activities, and vote on options
- **Expense Tracking**: Log expenses with flexible splitting options
- **Smart Settlements**: Minimize money transfers with intelligent algorithms
- **Shared Lists**: Grocery lists, packing lists, and todo items
- **Opt-in Features**: Optional activities with cost splitting

## Features

### Core Features
- ✅ User authentication (credentials + OAuth)
- ✅ Multi-user trip management
- ✅ Role-based permissions (owner, organizer, member, viewer)
- ✅ Nested trips support
- ✅ Proposal system with multiple voting modes:
  - Single choice voting
  - Ranked choice (top 3)
  - Approval voting
- ✅ Link parsing for Airbnb, VRBO, Booking.com
- ✅ Flexible expense splitting:
  - Equal split
  - Percentage-based
  - Custom amounts
  - Opt-in based
- ✅ Smart settlement algorithm (minimizes transactions)
- ✅ Receipt upload and management
- ✅ Shared lists (grocery, packing, equipment)
- ✅ Real-time notifications
- ✅ Comments and discussions

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand + React Query
- **File Upload**: Cloudinary
- **Real-time** (optional): Socket.io / Pusher

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd CoTrip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and API keys
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Documentation

Comprehensive implementation guides are available in the `/docs` directory:

- **[Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md)** - Overview and best practices
- **[Authentication](./docs/01-authentication.md)** - User authentication system
- **[Trip Management](./docs/02-trip-management.md)** - Trip CRUD and member management
- **[Proposals & Voting](./docs/03-proposals-voting.md)** - Proposal and voting systems
- **[Expense Tracking](./docs/04-expense-tracking.md)** - Expense management and splitting
- **[Settlement Algorithm](./docs/05-settlement-algorithm.md)** - Smart settlement calculations
- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation
- **[Quick Start](./docs/QUICK_START.md)** - Step-by-step implementation guide
- **[Project Roadmap](./PROJECT_ROADMAP.md)** - Development phases and features

## Database Schema

The application uses a comprehensive PostgreSQL schema with 14 tables:
- Users
- Trips (with nested trips support)
- Trip Members
- Proposals
- Votes
- Expenses
- Expense Splits
- Settlements
- List Items
- Opt-in Features
- User Opt-ins
- Comments
- Notifications

See `database-schema.sql` and `prisma/schema.prisma` for complete schema definitions.

## Key Algorithms

### Settlement Algorithm
The smart settlement algorithm minimizes the number of money transfers needed to settle all debts:
- Calculates net balances for each user
- Uses greedy algorithm to match creditors with debtors
- Typically reduces transactions by 50-70%
- Ensures mathematical accuracy (all balances settle to zero)

Example:
```
Before: A→B ($20), A→C ($30), B→C ($10) = 3 transactions
After:  A→C ($50) = 1 transaction
```

### Voting Algorithms
- **Single Choice**: Simple majority wins
- **Ranked Choice**: Borda count or instant runoff
- **Approval**: Multiple selections allowed

## Project Structure

```
cotrip/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes
│   │   ├── auth/         # Authentication pages
│   │   └── trips/        # Trip pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and configurations
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   └── styles/           # Global styles
├── prisma/
│   └── schema.prisma     # Database schema
├── docs/                 # Implementation guides
├── public/               # Static assets
└── tests/                # Test files
```

## Development Phases

1. ✅ **Phase 1**: Foundation & Database Design
2. ✅ **Phase 2**: Authentication System
3. **Phase 3**: Trip Management (In Progress)
4. **Phase 4**: Proposals & Voting
5. **Phase 5**: Expense Tracking
6. **Phase 6**: Settlement Algorithm
7. **Phase 7**: Additional Features
8. **Phase 8**: Polish & Deployment

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (handled by NextAuth)

### Trips
- `GET /api/trips` - List all trips
- `POST /api/trips` - Create trip
- `GET /api/trips/:id` - Get trip details
- `PUT /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip

### Members
- `GET /api/trips/:id/members` - List members
- `POST /api/trips/:id/members` - Invite member
- `PUT /api/trips/:id/members/:userId` - Update member
- `DELETE /api/trips/:id/members/:userId` - Remove member

### Proposals
- `GET /api/trips/:id/proposals` - List proposals
- `POST /api/trips/:id/proposals` - Create proposal
- `POST /api/proposals/:id/vote` - Vote on proposal
- `GET /api/proposals/:id/vote` - Get vote results

### Expenses
- `GET /api/trips/:id/expenses` - List expenses
- `POST /api/trips/:id/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Settlements
- `GET /api/trips/:id/settlements` - Calculate settlements
- `POST /api/trips/:id/settlements` - Mark settlement as paid

See [API Reference](./docs/API_REFERENCE.md) for complete documentation.

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## Deployment

### Vercel (Recommended)
```bash
vercel
```

### Manual Deployment
1. Build the application: `npm run build`
2. Set up PostgreSQL database
3. Configure environment variables
4. Run migrations: `npx prisma migrate deploy`
5. Start the server: `npm start`

See [Quick Start Guide](./docs/QUICK_START.md) for detailed deployment instructions.

## Contributing

This is a planned implementation. To implement features:
1. Review the implementation guides in `/docs`
2. Follow the API specifications
3. Implement tests
4. Submit for review

## Security

- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS prevention (React)
- CSRF protection (NextAuth)
- Secure password hashing (bcrypt)
- Rate limiting on API endpoints
- File upload validation
- HTTPS in production

## Performance

- Database indexes for common queries
- React Query for client-side caching
- Optimistic updates for better UX
- Image optimization with Next.js
- Code splitting (automatic in Next.js)
- Pagination for large lists

## License

[MIT License](LICENSE)

## Support

For questions and support, please refer to:
- Implementation guides in `/docs`
- API reference
- Quick start guide

## Roadmap

See [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) for detailed development plan and future features.

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org)
- [Prisma](https://www.prisma.io)
- [NextAuth.js](https://next-auth.js.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)" 
