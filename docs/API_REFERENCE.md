# CoTrip API Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a valid session cookie from NextAuth.

### Headers
```
Content-Type: application/json
Cookie: next-auth.session-token=<token>
```

---

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Body**:
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123",
  "fullName": "John Doe" // optional
}
```

**Response** (201):
```json
{
  "message": "User created successfully",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe"
  }
}
```

---

## Trip Endpoints

### List All Trips
```http
GET /api/trips
```

**Response** (200):
```json
[
  {
    "id": "clx...",
    "name": "Summer Vacation 2025",
    "description": "Beach trip with friends",
    "destination": "Malibu, CA",
    "startDate": "2025-07-01T00:00:00Z",
    "endDate": "2025-07-07T00:00:00Z",
    "status": "planning",
    "members": [...],
    "_count": {
      "proposals": 5,
      "expenses": 12
    }
  }
]
```

### Create Trip
```http
POST /api/trips
```

**Body**:
```json
{
  "name": "Summer Vacation 2025",
  "description": "Beach trip with friends",
  "destination": "Malibu, CA",
  "startDate": "2025-07-01T00:00:00Z",
  "endDate": "2025-07-07T00:00:00Z",
  "costStructure": "per_user",
  "totalBudget": 5000,
  "currency": "USD"
}
```

**Response** (201): Same as GET single trip

### Get Trip Details
```http
GET /api/trips/:id
```

**Response** (200):
```json
{
  "id": "clx...",
  "name": "Summer Vacation 2025",
  "description": "Beach trip with friends",
  "destination": "Malibu, CA",
  "startDate": "2025-07-01T00:00:00Z",
  "endDate": "2025-07-07T00:00:00Z",
  "status": "planning",
  "members": [
    {
      "id": "clx...",
      "role": "owner",
      "user": {
        "id": "clx...",
        "fullName": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "proposals": [...],
  "expenses": [...],
  "_count": {
    "proposals": 5,
    "expenses": 12
  }
}
```

### Update Trip
```http
PUT /api/trips/:id
```

**Body**: Same as create trip (all fields optional)

**Response** (200): Updated trip object

### Delete Trip
```http
DELETE /api/trips/:id
```

**Response** (200):
```json
{
  "message": "Trip deleted successfully"
}
```

---

## Member Endpoints

### List Trip Members
```http
GET /api/trips/:tripId/members
```

**Response** (200):
```json
[
  {
    "id": "clx...",
    "role": "owner",
    "status": "active",
    "joinedAt": "2025-01-01T00:00:00Z",
    "costPercentage": null,
    "user": {
      "id": "clx...",
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  }
]
```

### Invite Member
```http
POST /api/trips/:tripId/members
```

**Body**:
```json
{
  "email": "newmember@example.com",
  "role": "member" // owner, organizer, member, viewer
}
```

**Response** (201): Member object

### Update Member
```http
PUT /api/trips/:tripId/members/:userId
```

**Body**:
```json
{
  "role": "organizer",
  "costPercentage": 25.5
}
```

**Response** (200): Updated member object

### Remove Member
```http
DELETE /api/trips/:tripId/members/:userId
```

**Response** (200):
```json
{
  "message": "Member removed successfully"
}
```

---

## Proposal Endpoints

### List Proposals
```http
GET /api/trips/:tripId/proposals
```

**Query Parameters**:
- `status` (optional): open, closed, selected
- `category` (optional): accommodation, activity, transportation, dining, other

**Response** (200):
```json
[
  {
    "id": "clx...",
    "title": "Beachfront Airbnb",
    "description": "5 bedroom house with ocean view",
    "category": "accommodation",
    "url": "https://airbnb.com/...",
    "price": 2500,
    "currency": "USD",
    "votingType": "ranked",
    "status": "open",
    "proposedBy": {...},
    "votes": [...],
    "_count": {
      "votes": 8,
      "comments": 3
    }
  }
]
```

### Create Proposal
```http
POST /api/trips/:tripId/proposals
```

**Body**:
```json
{
  "category": "accommodation",
  "title": "Beachfront Airbnb",
  "description": "5 bedroom house with ocean view",
  "url": "https://airbnb.com/...",
  "price": 2500,
  "currency": "USD",
  "votingType": "ranked", // single, ranked, approval
  "votingDeadline": "2025-06-15T00:00:00Z"
}
```

**Response** (201): Proposal object

### Vote on Proposal
```http
POST /api/proposals/:proposalId/vote
```

**Body (single choice)**:
```json
{
  "voteValue": 1 // 1=yes, 0=no
}
```

**Body (ranked choice)**:
```json
{
  "rankings": [
    { "rank": 1 },
    { "rank": 2 },
    { "rank": 3 }
  ]
}
```

**Response** (200):
```json
{
  "message": "Vote recorded successfully"
}
```

### Get Vote Results
```http
GET /api/proposals/:proposalId/vote
```

**Response** (200):
```json
{
  "proposal": {...},
  "results": {
    "yes": 5,
    "no": 2,
    "total": 7
  },
  "votes": [...]
}
```

---

## Expense Endpoints

### List Expenses
```http
GET /api/trips/:tripId/expenses
```

**Query Parameters**:
- `category` (optional): Filter by category
- `status` (optional): pending, approved, rejected

**Response** (200):
```json
[
  {
    "id": "clx...",
    "amount": 150.50,
    "currency": "USD",
    "category": "food",
    "description": "Groceries for the trip",
    "receiptUrl": "https://...",
    "expenseDate": "2025-07-02T00:00:00Z",
    "splitType": "equal",
    "status": "approved",
    "paidBy": {
      "id": "clx...",
      "fullName": "John Doe"
    },
    "splits": [
      {
        "userId": "clx...",
        "amount": 50.17,
        "percentage": 33.33,
        "isSettled": false
      }
    ]
  }
]
```

### Create Expense
```http
POST /api/trips/:tripId/expenses
```

**Body**:
```json
{
  "amount": 150.50,
  "currency": "USD",
  "category": "food",
  "description": "Groceries for the trip",
  "receiptUrl": "https://...",
  "expenseDate": "2025-07-02T00:00:00Z",
  "splitType": "equal", // equal, percentage, amount, opt_in
  "splits": [ // required for percentage and amount types
    {
      "userId": "clx...",
      "percentage": 40
    },
    {
      "userId": "clx...",
      "percentage": 60
    }
  ]
}
```

**Response** (201): Expense object

### Update Expense
```http
PUT /api/expenses/:id
```

**Body**: Same as create (all fields optional)

**Response** (200): Updated expense object

### Delete Expense
```http
DELETE /api/expenses/:id
```

**Response** (200):
```json
{
  "message": "Expense deleted successfully"
}
```

---

## Settlement Endpoints

### Calculate Settlements
```http
GET /api/trips/:tripId/settlements
```

**Response** (200):
```json
{
  "balances": [
    {
      "userId": "clx...",
      "user": {...},
      "paid": 300.00,
      "owed": 250.00,
      "balance": 50.00
    }
  ],
  "suggestedSettlements": [
    {
      "from": "user-id-1",
      "fromUser": {...},
      "to": "user-id-2",
      "toUser": {...},
      "amount": 75.50
    }
  ],
  "existingSettlements": [...],
  "totalExpenses": 1500.00
}
```

### Mark Settlement as Paid
```http
POST /api/trips/:tripId/settlements
```

**Body**:
```json
{
  "fromUserId": "clx...",
  "toUserId": "clx...",
  "amount": 75.50,
  "paymentMethod": "Venmo",
  "paymentReference": "@username"
}
```

**Response** (201): Settlement object

---

## List Endpoints

### Get Trip Lists
```http
GET /api/trips/:tripId/lists
```

**Query Parameters**:
- `category` (optional): grocery, packing, todo, equipment

**Response** (200):
```json
[
  {
    "id": "clx...",
    "category": "grocery",
    "name": "Milk",
    "quantity": 2,
    "unit": "gallons",
    "estimatedCost": 8.00,
    "actualCost": 7.50,
    "assignedTo": {...},
    "purchasedBy": {...},
    "status": "completed"
  }
]
```

### Add List Item
```http
POST /api/trips/:tripId/lists
```

**Body**:
```json
{
  "category": "grocery",
  "name": "Milk",
  "quantity": 2,
  "unit": "gallons",
  "estimatedCost": 8.00,
  "assignedToId": "user-id"
}
```

**Response** (201): List item object

### Update List Item
```http
PUT /api/lists/:itemId
```

**Body**: Same as create (all fields optional)

**Response** (200): Updated list item

### Delete List Item
```http
DELETE /api/lists/:itemId
```

**Response** (200):
```json
{
  "message": "List item deleted successfully"
}
```

---

## Notification Endpoints

### Get User Notifications
```http
GET /api/notifications
```

**Query Parameters**:
- `unread` (optional): boolean

**Response** (200):
```json
[
  {
    "id": "clx...",
    "type": "new_proposal",
    "title": "New Proposal",
    "message": "John Doe added a new accommodation proposal",
    "data": {
      "proposalId": "clx..."
    },
    "isRead": false,
    "createdAt": "2025-01-15T10:30:00Z"
  }
]
```

### Mark Notification as Read
```http
PUT /api/notifications/:id/read
```

**Response** (200):
```json
{
  "message": "Notification marked as read"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute per IP address
- 1000 requests per hour per user

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642518000
```

---

## Pagination

List endpoints support pagination:

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page

**Response Headers**:
```
X-Total-Count: 150
X-Page: 1
X-Per-Page: 20
X-Total-Pages: 8
```

---

## Webhooks (Future)

Subscribe to events:
- `trip.created`
- `trip.updated`
- `member.added`
- `proposal.created`
- `vote.submitted`
- `expense.created`
- `settlement.paid`