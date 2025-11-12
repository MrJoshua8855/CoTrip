# Voting System Architecture

## Overview

CoTrip implements two voting modes to help groups make democratic decisions about accommodations, activities, and other trip-related proposals.

## Voting Modes

### 1. Single Choice Voting (Simple Majority)

**Use Case**: Quick decisions where one clear winner is needed.

**How it works**:
- Each member gets one vote
- Member votes for their preferred option
- Option with most votes wins
- In case of tie, proposal creator decides or revote

**Example**: Choosing between 2-3 restaurants for dinner

### 2. Ranked Choice Voting (Top 3)

**Use Case**: Complex decisions with multiple good options where preference intensity matters.

**How it works**:
- Each member ranks up to 3 options (1st, 2nd, 3rd choice)
- Points are assigned: 1st = 3 points, 2nd = 2 points, 3rd = 1 point
- Option with highest total points wins
- Handles ties and partial rankings gracefully

**Example**: Choosing between 5+ Airbnb options

## Database Schema

### Proposals Table
```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  type VARCHAR(50), -- accommodation, activity, restaurant, etc.
  title VARCHAR(255),
  description TEXT,
  external_url TEXT,
  estimated_cost DECIMAL(10, 2),
  cost_currency VARCHAR(3) DEFAULT 'USD',
  voting_mode VARCHAR(20) CHECK (voting_mode IN ('single_choice', 'ranked_choice')),
  voting_deadline TIMESTAMP,
  status VARCHAR(20) CHECK (status IN ('open', 'closed', 'accepted', 'rejected')),
  metadata JSONB, -- flexible storage for images, amenities, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Votes Table
```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  rank INTEGER CHECK (rank >= 1 AND rank <= 3), -- NULL for single choice
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- For single choice: (proposal_id, user_id) must be unique
  -- For ranked choice: (proposal_id, user_id, rank) must be unique
  UNIQUE(proposal_id, user_id, rank)
);
```

## Algorithms

### Single Choice Vote Count

```javascript
async function calculateSingleChoiceResults(proposalId) {
  const votes = await Vote.findAll({
    where: { proposal_id: proposalId },
    include: [{ model: User, attributes: ['id', 'name'] }]
  });

  const totalVotes = votes.length;
  const voteCount = votes.length;

  return {
    totalVotes,
    voteCount,
    percentage: totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0,
    voters: votes.map(v => ({ id: v.user.id, name: v.user.name }))
  };
}
```

### Ranked Choice Vote Calculation

```javascript
const RANK_POINTS = {
  1: 3, // 1st choice = 3 points
  2: 2, // 2nd choice = 2 points
  3: 1  // 3rd choice = 1 point
};

async function calculateRankedChoiceResults(proposals) {
  // Get all votes for these proposals
  const votes = await Vote.findAll({
    where: { 
      proposal_id: { [Op.in]: proposals.map(p => p.id) }
    },
    include: [{ model: User, attributes: ['id', 'name'] }]
  });

  // Calculate points for each proposal
  const results = proposals.map(proposal => {
    const proposalVotes = votes.filter(v => v.proposal_id === proposal.id);
    
    // Calculate total points
    const totalPoints = proposalVotes.reduce((sum, vote) => {
      return sum + (RANK_POINTS[vote.rank] || 0);
    }, 0);

    // Calculate breakdown by rank
    const breakdown = {
      first_choice: proposalVotes.filter(v => v.rank === 1).length,
      second_choice: proposalVotes.filter(v => v.rank === 2).length,
      third_choice: proposalVotes.filter(v => v.rank === 3).length
    };

    // Get voters
    const voters = proposalVotes.map(v => ({
      userId: v.user.id,
      name: v.user.name,
      rank: v.rank,
      points: RANK_POINTS[v.rank]
    }));

    return {
      proposalId: proposal.id,
      title: proposal.title,
      totalPoints,
      voteCount: proposalVotes.length,
      breakdown,
      voters,
      averageRank: proposalVotes.length > 0 
        ? proposalVotes.reduce((sum, v) => sum + v.rank, 0) / proposalVotes.length 
        : 0
    };
  });

  // Sort by total points (descending)
  results.sort((a, b) => b.totalPoints - a.totalPoints);

  // Add rankings
  results.forEach((result, index) => {
    result.ranking = index + 1;
  });

  return results;
}
```

## API Endpoints

### Create Proposal
```http
POST /api/v1/trips/:tripId/proposals
Content-Type: application/json

{
  "type": "accommodation",
  "title": "Cozy Mountain Cabin",
  "description": "3 bedroom cabin with lake view",
  "external_url": "https://airbnb.com/...",
  "estimated_cost": 450.00,
  "voting_mode": "ranked_choice",
  "voting_deadline": "2025-12-01T23:59:59Z",
  "metadata": {
    "images": ["url1", "url2"],
    "bedrooms": 3,
    "amenities": ["wifi", "kitchen", "parking"]
  }
}
```

### Cast Vote (Single Choice)
```http
POST /api/v1/proposals/:proposalId/votes
Content-Type: application/json

{
  "comment": "Perfect location!"
}
```

### Cast Vote (Ranked Choice)
```http
POST /api/v1/proposals/:proposalId/votes
Content-Type: application/json

{
  "rank": 1,
  "comment": "My top choice!"
}

// Same user can vote for 3 different proposals with ranks 1, 2, 3
```

### Update Vote
```http
PATCH /api/v1/proposals/:proposalId/votes/:voteId
Content-Type: application/json

{
  "rank": 2,
  "comment": "Changed my mind, this is my 2nd choice now"
}
```

### Get Voting Results
```http
GET /api/v1/proposals/:proposalId/results

Response:
{
  "success": true,
  "data": {
    "proposal": { /* proposal details */ },
    "voting_mode": "ranked_choice",
    "is_closed": false,
    "deadline": "2025-12-01T23:59:59Z",
    "total_members": 10,
    "votes_cast": 8,
    "results": {
      "totalPoints": 18,
      "ranking": 1,
      "breakdown": {
        "first_choice": 4,
        "second_choice": 3,
        "third_choice": 1
      },
      "voters": [
        {
          "userId": "uuid",
          "name": "Alice",
          "rank": 1,
          "points": 3,
          "comment": "Perfect!"
        }
      ]
    }
  }
}
```

### Get All Results for a Voting Group
```http
GET /api/v1/trips/:tripId/proposals/category/:category/results

// Returns comparative results for all proposals in a category
// (e.g., all accommodation options together)
```

## Voting Rules & Logic

### Voting Eligibility
```javascript
async function canUserVote(userId, proposalId) {
  const proposal = await Proposal.findByPk(proposalId, {
    include: [{ model: Trip }]
  });

  // Check if user is active member
  const member = await TripMember.findOne({
    where: {
      trip_id: proposal.trip_id,
      user_id: userId,
      is_active: true
    }
  });

  if (!member) {
    return { allowed: false, reason: 'Not a trip member' };
  }

  // Check if voting is open
  if (proposal.status !== 'open') {
    return { allowed: false, reason: 'Voting is closed' };
  }

  // Check if deadline passed
  if (proposal.voting_deadline && new Date() > new Date(proposal.voting_deadline)) {
    return { allowed: false, reason: 'Voting deadline passed' };
  }

  return { allowed: true };
}
```

### Ranked Choice Validation
```javascript
async function validateRankedVote(userId, proposalId, rank) {
  // Check if user already used this rank for another proposal in same group
  const existingVote = await Vote.findOne({
    where: { user_id: userId, rank },
    include: [{
      model: Proposal,
      where: {
        trip_id: (await Proposal.findByPk(proposalId)).trip_id,
        type: (await Proposal.findByPk(proposalId)).type,
        status: 'open'
      }
    }]
  });

  if (existingVote && existingVote.proposal_id !== proposalId) {
    return {
      valid: false,
      reason: `You already used rank ${rank} for "${existingVote.Proposal.title}"`
    };
  }

  return { valid: true };
}
```

### Automatic Deadline Closure
```javascript
// Cron job or scheduled task
async function closeExpiredVotes() {
  const now = new Date();

  const expiredProposals = await Proposal.findAll({
    where: {
      status: 'open',
      voting_deadline: { [Op.lt]: now }
    }
  });

  for (const proposal of expiredProposals) {
    // Update status
    await proposal.update({ status: 'closed' });

    // Calculate final results
    const results = await calculateResults(proposal.id);

    // Notify members
    await notifyMembers(proposal.trip_id, {
      type: 'vote_closed',
      proposal_id: proposal.id,
      results
    });
  }
}

// Run every minute
setInterval(closeExpiredVotes, 60 * 1000);
```

## Frontend Implementation

### Single Choice Voting UI

```jsx
function SingleChoiceVote({ proposal, currentVote, onVote }) {
  const [comment, setComment] = useState(currentVote?.comment || '');
  const hasVoted = !!currentVote;

  const handleVote = async () => {
    if (hasVoted) {
      await updateVote(currentVote.id, { comment });
    } else {
      await createVote(proposal.id, { comment });
    }
    onVote();
  };

  return (
    <Card>
      <CardHeader>
        <h3>{proposal.title}</h3>
        {proposal.estimated_cost && (
          <Badge>${proposal.estimated_cost}</Badge>
        )}
      </CardHeader>
      <CardBody>
        <p>{proposal.description}</p>
        {proposal.external_url && (
          <a href={proposal.external_url} target="_blank">View Details</a>
        )}
      </CardBody>
      <CardFooter>
        <Button
          variant={hasVoted ? 'success' : 'primary'}
          onClick={handleVote}
          disabled={proposal.status !== 'open'}
        >
          {hasVoted ? '✓ Voted' : 'Vote for this'}
        </Button>
        <Input
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </CardFooter>
    </Card>
  );
}
```

### Ranked Choice Voting UI

```jsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

function RankedChoiceVoting({ proposals, currentVotes, onVote }) {
  const [rankings, setRankings] = useState({
    1: currentVotes.find(v => v.rank === 1)?.proposal_id || null,
    2: currentVotes.find(v => v.rank === 2)?.proposal_id || null,
    3: currentVotes.find(v => v.rank === 3)?.proposal_id || null,
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const proposalId = draggableId;

    // Update rankings
    const newRankings = { ...rankings };
    
    // Remove from source rank
    if (source.droppableId.startsWith('rank-')) {
      const sourceRank = parseInt(source.droppableId.split('-')[1]);
      if (newRankings[sourceRank] === proposalId) {
        newRankings[sourceRank] = null;
      }
    }

    // Add to destination rank
    if (destination.droppableId.startsWith('rank-')) {
      const destRank = parseInt(destination.droppableId.split('-')[1]);
      newRankings[destRank] = proposalId;
    }

    setRankings(newRankings);
  };

  const handleSave = async () => {
    // Cast votes for each ranking
    for (const [rank, proposalId] of Object.entries(rankings)) {
      if (proposalId) {
        const existingVote = currentVotes.find(
          v => v.proposal_id === proposalId
        );
        
        if (existingVote) {
          await updateVote(existingVote.id, { rank: parseInt(rank) });
        } else {
          await createVote(proposalId, { rank: parseInt(rank) });
        }
      }
    }
    onVote();
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="ranked-voting">
        <h3>Drag to rank your top 3 choices</h3>
        
        {[1, 2, 3].map(rank => (
          <Droppable key={rank} droppableId={`rank-${rank}`}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="rank-slot"
              >
                <label>
                  {rank === 1 ? '🥇 First Choice' : 
                   rank === 2 ? '🥈 Second Choice' : 
                   '🥉 Third Choice'}
                </label>
                {rankings[rank] && (
                  <ProposalCard 
                    proposal={proposals.find(p => p.id === rankings[rank])} 
                  />
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}

        <Droppable droppableId="unranked">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="unranked-proposals"
            >
              <h4>Available Options</h4>
              {proposals
                .filter(p => !Object.values(rankings).includes(p.id))
                .map((proposal, index) => (
                  <Draggable 
                    key={proposal.id} 
                    draggableId={proposal.id} 
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <ProposalCard proposal={proposal} />
                      </div>
                    )}
                  </Draggable>
                ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <Button onClick={handleSave}>Save Rankings</Button>
      </div>
    </DragDropContext>
  );
}
```

### Results Visualization

```jsx
function RankedChoiceResults({ results }) {
  return (
    <div className="voting-results">
      <h3>Voting Results</h3>
      {results.map((result, index) => (
        <Card key={result.proposalId} className={index === 0 ? 'winner' : ''}>
          <div className="result-header">
            <span className="rank">#{result.ranking}</span>
            <h4>{result.title}</h4>
            <Badge variant="success">{result.totalPoints} points</Badge>
          </div>
          
          <div className="vote-breakdown">
            <div className="breakdown-bar">
              <div 
                className="first-choice" 
                style={{ width: `${(result.breakdown.first_choice / result.voteCount) * 100}%` }}
                title={`${result.breakdown.first_choice} first choice votes`}
              />
              <div 
                className="second-choice" 
                style={{ width: `${(result.breakdown.second_choice / result.voteCount) * 100}%` }}
                title={`${result.breakdown.second_choice} second choice votes`}
              />
              <div 
                className="third-choice" 
                style={{ width: `${(result.breakdown.third_choice / result.voteCount) * 100}%` }}
                title={`${result.breakdown.third_choice} third choice votes`}
              />
            </div>
            
            <div className="breakdown-labels">
              <span>🥇 {result.breakdown.first_choice}</span>
              <span>🥈 {result.breakdown.second_choice}</span>
              <span>🥉 {result.breakdown.third_choice}</span>
            </div>
          </div>

          {index === 0 && <Badge variant="winner">🏆 Winner</Badge>}
        </Card>
      ))}
    </div>
  );
}
```

## Notifications

### Vote Deadline Reminders
```javascript
// 24 hours before deadline
async function sendDeadlineReminders() {
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() + 24);

  const proposals = await Proposal.findAll({
    where: {
      status: 'open',
      voting_deadline: {
        [Op.between]: [new Date(), tomorrow]
      }
    },
    include: [{ model: Trip, include: [{ model: TripMember }] }]
  });

  for (const proposal of proposals) {
    // Find members who haven't voted
    const votes = await Vote.findAll({
      where: { proposal_id: proposal.id }
    });
    const votedUserIds = votes.map(v => v.user_id);

    const nonVoters = proposal.Trip.TripMembers.filter(
      m => !votedUserIds.includes(m.user_id)
    );

    // Send reminders
    for (const member of nonVoters) {
      await sendNotification(member.user_id, {
        type: 'vote_reminder',
        title: 'Vote Deadline Soon',
        message: `"${proposal.title}" voting closes in 24 hours`,
        link: `/trips/${proposal.trip_id}/proposals/${proposal.id}`
      });
    }
  }
}
```

## Testing

### Unit Tests
```javascript
describe('Ranked Choice Voting', () => {
  it('should calculate points correctly', () => {
    const votes = [
      { proposal_id: 'A', rank: 1 }, // 3 points
      { proposal_id: 'A', rank: 2 }, // 2 points
      { proposal_id: 'B', rank: 1 }, // 3 points
      { proposal_id: 'B', rank: 3 }, // 1 point
    ];

    const results = calculateRankedChoiceResults([
      { id: 'A', title: 'Option A' },
      { id: 'B', title: 'Option B' }
    ], votes);

    expect(results[0].proposalId).toBe('A');
    expect(results[0].totalPoints).toBe(5);
    expect(results[1].proposalId).toBe('B');
    expect(results[1].totalPoints).toBe(4);
  });

  it('should handle ties correctly', () => {
    const votes = [
      { proposal_id: 'A', rank: 1 },
      { proposal_id: 'B', rank: 1 }
    ];

    const results = calculateRankedChoiceResults([
      { id: 'A', title: 'Option A' },
      { id: 'B', title: 'Option B' }
    ], votes);

    expect(results[0].totalPoints).toBe(3);
    expect(results[1].totalPoints).toBe(3);
    expect(results[0].ranking).toBe(1);
    expect(results[1].ranking).toBe(1); // Both rank 1 in tie
  });
});
```

## Best Practices

1. **Clear Deadlines**: Always set voting deadlines to create urgency
2. **Minimum Votes**: Consider requiring minimum participation (e.g., 75% of members)
3. **Tie Handling**: Define clear tie-breaking rules (creator decides, extend voting, revote)
4. **Vote Privacy**: Consider hiding results until voting closes to avoid bias
5. **Vote Changes**: Allow users to change votes before deadline
6. **Notifications**: Remind users about pending votes regularly
7. **Mobile-First**: Ensure voting UI works seamlessly on mobile devices

## Future Enhancements

- **Weighted Voting**: Different members have different vote weights
- **Approval Voting**: Vote for multiple acceptable options
- **Condorcet Method**: More sophisticated ranked choice calculation
- **Anonymous Voting**: Hide who voted for what
- **Delegate Voting**: Allow members to delegate their vote to another member
- **Quadratic Voting**: Use points budget for intensity of preferences

