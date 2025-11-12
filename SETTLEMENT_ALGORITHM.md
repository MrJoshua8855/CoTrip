# Settlement Algorithm - Transaction Minimization

## Overview

The settlement system calculates who owes whom and minimizes the number of transactions required to settle all debts within a trip.

## Problem Statement

Given a set of people who have shared expenses:
- Some people have paid more than their share (creditors)
- Some people have paid less than their share (debtors)
- We need to determine the minimum number of transactions to settle all debts

## Algorithm Approach

### Step 1: Calculate Net Balance

For each member:
```
net_balance = total_paid - total_owed
```

- Positive balance = creditor (owed money)
- Negative balance = debtor (owes money)
- Zero balance = settled

### Step 2: Greedy Matching Algorithm

This algorithm minimizes transactions by matching the largest debts with the largest credits.

```javascript
function calculateSettlements(members, expenses) {
  // Step 1: Calculate net balance for each member
  const balances = members.map(member => ({
    userId: member.id,
    name: member.name,
    balance: 0
  }));

  // Add up all payments
  expenses.forEach(expense => {
    const payer = balances.find(b => b.userId === expense.paid_by);
    payer.balance += expense.amount;
    
    // Subtract splits
    expense.splits.forEach(split => {
      const debtor = balances.find(b => b.userId === split.user_id);
      debtor.balance -= split.amount_owed;
    });
  });

  // Step 2: Separate creditors and debtors
  const creditors = balances
    .filter(b => b.balance > 0.01) // Use small epsilon for floating point
    .sort((a, b) => b.balance - a.balance); // Descending

  const debtors = balances
    .filter(b => b.balance < -0.01)
    .map(b => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance); // Descending

  // Step 3: Match creditors with debtors
  const settlements = [];
  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    // Calculate settlement amount
    const amount = Math.min(creditor.balance, debtor.balance);

    settlements.push({
      from_user_id: debtor.userId,
      to_user_id: creditor.userId,
      amount: Math.round(amount * 100) / 100 // Round to 2 decimals
    });

    // Update balances
    creditor.balance -= amount;
    debtor.balance -= amount;

    // Move to next creditor or debtor
    if (creditor.balance < 0.01) i++;
    if (debtor.balance < 0.01) j++;
  }

  return settlements;
}
```

## Example

### Given Expenses:
- Alice paid $100 for accommodation (split evenly among Alice, Bob, Charlie)
- Bob paid $60 for dinner (split evenly among Alice, Bob, Charlie)
- Charlie paid $30 for activity (split evenly among Alice, Bob, Charlie)

### Step 1: Calculate Net Balances

```
Alice:  paid $100, owes $63.33 → balance = +$36.67 (creditor)
Bob:    paid $60,  owes $63.33 → balance = -$3.33  (debtor)
Charlie: paid $30,  owes $63.33 → balance = -$33.33 (debtor)
```

### Step 2: Sort

```
Creditors: [Alice: $36.67]
Debtors:   [Charlie: $33.33, Bob: $3.33]
```

### Step 3: Match

```
Transaction 1: Charlie → Alice: $33.33
  - Charlie's debt: $33.33 - $33.33 = $0 (settled)
  - Alice's credit: $36.67 - $33.33 = $3.34 (remaining)

Transaction 2: Bob → Alice: $3.33
  - Bob's debt: $3.33 - $3.33 = $0 (settled)
  - Alice's credit: $3.34 - $3.33 = $0.01 (≈ $0, settled)
```

### Result
**2 transactions** instead of 6 possible transactions (if everyone settled individually with everyone else).

## Time Complexity

- **O(n log n)** for sorting
- **O(n)** for matching
- **Overall: O(n log n)** where n is the number of members

## Space Complexity

- **O(n)** for storing balances and settlements

## Edge Cases

### 1. All Members Settled
```javascript
if (creditors.length === 0 && debtors.length === 0) {
  return []; // No settlements needed
}
```

### 2. Floating Point Precision
Use epsilon (0.01) for comparisons to avoid floating point errors:
```javascript
const EPSILON = 0.01;
if (Math.abs(balance) < EPSILON) {
  balance = 0;
}
```

### 3. Single Transaction
If only one creditor and one debtor, result is a single transaction.

### 4. Currency Conversion
For multi-currency support, convert all amounts to a base currency before calculation:
```javascript
function convertToBaseCurrency(amount, fromCurrency, toCurrency, rates) {
  if (fromCurrency === toCurrency) return amount;
  return amount * (rates[toCurrency] / rates[fromCurrency]);
}
```

## Optimization: Transaction Minimization Proof

The greedy algorithm is optimal for this problem:

1. **Proof by Contradiction:**
   - Assume optimal solution requires fewer transactions
   - Each transaction settles at least one person completely
   - Minimum transactions = max(|creditors|, |debtors|)
   - Greedy algorithm achieves this bound

2. **Why Greedy Works:**
   - Matching largest balances first ensures maximum settlement per transaction
   - Each transaction eliminates at least one person from consideration
   - Total sum of credits = total sum of debts (conservation of money)

## Implementation Considerations

### Database Optimization
```sql
-- Efficient query to calculate balances
SELECT 
  u.id,
  u.name,
  COALESCE(SUM(e.amount), 0) AS total_paid,
  COALESCE(SUM(es.amount_owed), 0) AS total_owed,
  COALESCE(SUM(e.amount), 0) - COALESCE(SUM(es.amount_owed), 0) AS net_balance
FROM users u
JOIN trip_members tm ON u.id = tm.user_id
LEFT JOIN expenses e ON e.paid_by = u.id AND e.trip_id = tm.trip_id
LEFT JOIN expense_splits es ON es.user_id = u.id 
  AND es.expense_id IN (
    SELECT id FROM expenses WHERE trip_id = tm.trip_id
  )
WHERE tm.trip_id = $1
GROUP BY u.id, u.name;
```

### Caching Strategy
```javascript
// Cache settlement calculations
const cacheKey = `settlements:${tripId}:${lastExpenseTimestamp}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const settlements = calculateSettlements(members, expenses);
await redis.setex(cacheKey, 3600, JSON.stringify(settlements)); // 1 hour TTL
return settlements;
```

### Real-time Updates
When a new expense is added or expense is modified:
```javascript
// Invalidate settlement cache
await redis.del(`settlements:${tripId}:*`);

// Emit WebSocket event
io.to(`trip:${tripId}`).emit('settlements:updated', {
  tripId,
  settlements: calculateSettlements(members, expenses)
});
```

## API Endpoint

```javascript
// GET /api/v1/trips/:tripId/settlements/calculate
router.get('/trips/:tripId/settlements/calculate', async (req, res) => {
  const { tripId } = req.params;
  
  // Get all expenses and members
  const expenses = await getExpensesWithSplits(tripId);
  const members = await getTripMembers(tripId);
  
  // Calculate settlements
  const settlements = calculateSettlements(members, expenses);
  
  // Get existing settlement records
  const existingSettlements = await getSettlements(tripId);
  
  return res.json({
    success: true,
    data: {
      suggested: settlements,
      recorded: existingSettlements,
      summary: {
        totalSettlements: settlements.length,
        totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0)
      }
    }
  });
});
```

## Testing

### Unit Test Example
```javascript
describe('Settlement Algorithm', () => {
  it('should minimize transactions', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ];
    
    const expenses = [
      {
        paid_by: '1',
        amount: 100,
        splits: [
          { user_id: '1', amount_owed: 33.33 },
          { user_id: '2', amount_owed: 33.33 },
          { user_id: '3', amount_owed: 33.34 }
        ]
      },
      {
        paid_by: '2',
        amount: 60,
        splits: [
          { user_id: '1', amount_owed: 20 },
          { user_id: '2', amount_owed: 20 },
          { user_id: '3', amount_owed: 20 }
        ]
      }
    ];
    
    const settlements = calculateSettlements(members, expenses);
    
    // Verify minimal transactions
    expect(settlements.length).toBeLessThanOrEqual(2);
    
    // Verify sum of settlements equals total imbalance
    const totalTransferred = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalTransferred).toBeCloseTo(46.67, 2);
  });
  
  it('should handle already settled scenario', () => {
    const members = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' }
    ];
    
    const expenses = [
      {
        paid_by: '1',
        amount: 50,
        splits: [
          { user_id: '1', amount_owed: 25 },
          { user_id: '2', amount_owed: 25 }
        ]
      },
      {
        paid_by: '2',
        amount: 50,
        splits: [
          { user_id: '1', amount_owed: 25 },
          { user_id: '2', amount_owed: 25 }
        ]
      }
    ];
    
    const settlements = calculateSettlements(members, expenses);
    expect(settlements.length).toBe(0);
  });
});
```

## UI Visualization

### Balance Summary
```
┌─────────────────────────────────────┐
│  Alice        +$36.67  (owed to)    │
│  Bob          -$3.33   (owes)       │
│  Charlie      -$33.34  (owes)       │
└─────────────────────────────────────┘
```

### Settlement Suggestions
```
┌─────────────────────────────────────┐
│  💸 Charlie → Alice: $33.34         │
│  💸 Bob → Alice: $3.33              │
│                                     │
│  Total: 2 transactions              │
│  [Mark All as Paid]                 │
└─────────────────────────────────────┘
```

### Visual Graph
```
     Charlie
       │
       │ $33.34
       ↓
     Alice ← $3.33 ← Bob
```

## Alternative: Simplification Algorithm

For even simpler UX, consider "settle through one person" approach:
- All debtors pay the designated person
- Designated person pays all creditors
- Pros: Very simple to understand
- Cons: More transactions, requires trust in one person

This can be offered as an alternative mode in settings.

## Conclusion

The greedy matching algorithm provides an optimal solution for transaction minimization with O(n log n) complexity. It's efficient, easy to implement, and produces intuitive results for users.
