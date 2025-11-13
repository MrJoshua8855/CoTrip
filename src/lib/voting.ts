/**
 * Voting Algorithm Utilities
 * Implements Single Choice, Ranked Choice (Borda Count), and Approval Voting
 */

export interface Vote {
  id: string;
  proposalId: string;
  userId: string;
  voteValue?: number | null;
  rank?: number | null;
  user?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

export interface Proposal {
  id: string;
  title: string;
  votes?: Vote[];
}

export interface SingleChoiceResult {
  proposalId: string;
  title: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  percentage: number;
  voters: Array<{
    userId: string;
    userName: string;
    vote: 'yes' | 'no';
  }>;
}

export interface RankedChoiceResult {
  proposalId: string;
  title: string;
  totalPoints: number;
  firstChoiceVotes: number;
  secondChoiceVotes: number;
  thirdChoiceVotes: number;
  totalVotes: number;
  averageRank: number;
  ranking: number;
  voters: Array<{
    userId: string;
    userName: string;
    rank: number;
    points: number;
  }>;
}

export interface ApprovalVotingResult {
  proposalId: string;
  title: string;
  approvalCount: number;
  totalVoters: number;
  approvalPercentage: number;
  ranking: number;
  voters: Array<{
    userId: string;
    userName: string;
  }>;
}

/**
 * Calculate Single Choice voting results
 * Returns winner by simple majority (yes vs no)
 */
export function calculateSingleChoice(
  proposal: Proposal,
  totalMembers: number
): SingleChoiceResult {
  const votes = proposal.votes || [];

  const yesVotes = votes.filter((v) => v.voteValue === 1);
  const noVotes = votes.filter((v) => v.voteValue === 0);

  const yesCount = yesVotes.length;
  const noCount = noVotes.length;
  const totalVotes = yesCount + noCount;

  const percentage = totalVotes > 0 ? (yesCount / totalVotes) * 100 : 0;

  const voters = [
    ...yesVotes.map((v) => ({
      userId: v.userId,
      userName: v.user?.fullName || 'Unknown',
      vote: 'yes' as const,
    })),
    ...noVotes.map((v) => ({
      userId: v.userId,
      userName: v.user?.fullName || 'Unknown',
      vote: 'no' as const,
    })),
  ];

  return {
    proposalId: proposal.id,
    title: proposal.title,
    yesVotes: yesCount,
    noVotes: noCount,
    totalVotes,
    percentage,
    voters,
  };
}

/**
 * Calculate Ranked Choice voting results using Borda Count
 * Points: 1st choice = 3 points, 2nd choice = 2 points, 3rd choice = 1 point
 */
export function calculateBordaCount(proposals: Proposal[]): RankedChoiceResult[] {
  const RANK_POINTS = {
    1: 3,
    2: 2,
    3: 1,
  };

  const results: RankedChoiceResult[] = proposals.map((proposal) => {
    const votes = proposal.votes || [];

    // Calculate points for each rank
    const totalPoints = votes.reduce((sum, vote) => {
      if (vote.rank && vote.rank >= 1 && vote.rank <= 3) {
        return sum + RANK_POINTS[vote.rank as keyof typeof RANK_POINTS];
      }
      return sum;
    }, 0);

    // Count votes by rank
    const firstChoiceVotes = votes.filter((v) => v.rank === 1).length;
    const secondChoiceVotes = votes.filter((v) => v.rank === 2).length;
    const thirdChoiceVotes = votes.filter((v) => v.rank === 3).length;
    const totalVotes = firstChoiceVotes + secondChoiceVotes + thirdChoiceVotes;

    // Calculate average rank (lower is better)
    const averageRank =
      totalVotes > 0
        ? votes.reduce((sum, v) => sum + (v.rank || 0), 0) / totalVotes
        : 0;

    // Build voters list
    const voters = votes
      .filter((v) => v.rank && v.rank >= 1 && v.rank <= 3)
      .map((v) => ({
        userId: v.userId,
        userName: v.user?.fullName || 'Unknown',
        rank: v.rank!,
        points: RANK_POINTS[v.rank as keyof typeof RANK_POINTS],
      }));

    return {
      proposalId: proposal.id,
      title: proposal.title,
      totalPoints,
      firstChoiceVotes,
      secondChoiceVotes,
      thirdChoiceVotes,
      totalVotes,
      averageRank,
      ranking: 0, // Will be set after sorting
      voters,
    };
  });

  // Sort by total points (descending), then by average rank (ascending)
  results.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // If points are equal, lower average rank wins
    return a.averageRank - b.averageRank;
  });

  // Assign rankings
  results.forEach((result, index) => {
    result.ranking = index + 1;
  });

  return results;
}

/**
 * Calculate Approval Voting results
 * Each voter can approve multiple proposals
 */
export function calculateApprovalVoting(
  proposals: Proposal[],
  totalMembers: number
): ApprovalVotingResult[] {
  const results: ApprovalVotingResult[] = proposals.map((proposal) => {
    const votes = proposal.votes || [];

    // In approval voting, any vote counts as approval
    const approvalCount = votes.filter((v) => v.voteValue === 1).length;

    const approvalPercentage =
      totalMembers > 0 ? (approvalCount / totalMembers) * 100 : 0;

    const voters = votes
      .filter((v) => v.voteValue === 1)
      .map((v) => ({
        userId: v.userId,
        userName: v.user?.fullName || 'Unknown',
      }));

    return {
      proposalId: proposal.id,
      title: proposal.title,
      approvalCount,
      totalVoters: totalMembers,
      approvalPercentage,
      ranking: 0, // Will be set after sorting
      voters,
    };
  });

  // Sort by approval count (descending)
  results.sort((a, b) => b.approvalCount - a.approvalCount);

  // Assign rankings (handle ties)
  let currentRank = 1;
  results.forEach((result, index) => {
    if (index > 0 && result.approvalCount < results[index - 1].approvalCount) {
      currentRank = index + 1;
    }
    result.ranking = currentRank;
  });

  return results;
}

/**
 * Get vote results for a proposal based on voting type
 */
export function getVoteResults(
  proposal: Proposal,
  votingType: string,
  allProposals?: Proposal[],
  totalMembers: number = 0
):
  | SingleChoiceResult
  | RankedChoiceResult
  | ApprovalVotingResult
  | null {
  switch (votingType.toLowerCase()) {
    case 'single':
    case 'single_choice':
      return calculateSingleChoice(proposal, totalMembers);

    case 'ranked':
    case 'ranked_choice':
      if (!allProposals) {
        allProposals = [proposal];
      }
      const rankedResults = calculateBordaCount(allProposals);
      return rankedResults.find((r) => r.proposalId === proposal.id) || null;

    case 'approval':
    case 'approval_voting':
      if (!allProposals) {
        allProposals = [proposal];
      }
      const approvalResults = calculateApprovalVoting(allProposals, totalMembers);
      return approvalResults.find((r) => r.proposalId === proposal.id) || null;

    default:
      return null;
  }
}

/**
 * Determine if voting deadline has passed
 */
export function isVotingClosed(votingDeadline: Date | string | null): boolean {
  if (!votingDeadline) {
    return false;
  }

  const deadline = new Date(votingDeadline);
  return deadline < new Date();
}

/**
 * Check if a user has already voted on a proposal
 */
export function hasUserVoted(
  votes: Vote[],
  userId: string
): boolean {
  return votes.some((v) => v.userId === userId);
}

/**
 * Get user's vote on a proposal
 */
export function getUserVote(
  votes: Vote[],
  userId: string
): Vote | null {
  return votes.find((v) => v.userId === userId) || null;
}

/**
 * Get user's ranked votes on multiple proposals
 * Used for ranked choice voting where user ranks multiple proposals
 */
export function getUserRankedVotes(
  votes: Vote[],
  userId: string
): Vote[] {
  return votes
    .filter((v) => v.userId === userId && v.rank !== null)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));
}

/**
 * Calculate participation rate
 */
export function calculateParticipationRate(
  totalVotes: number,
  totalMembers: number
): number {
  if (totalMembers === 0) return 0;
  return (totalVotes / totalMembers) * 100;
}

/**
 * Handle tie breaking
 * Returns array of proposals that are tied for first place
 */
export function findTiedWinners(
  results: Array<RankedChoiceResult | ApprovalVotingResult | SingleChoiceResult>
): string[] {
  if (results.length === 0) return [];

  const topScore = getResultScore(results[0]);
  return results
    .filter((r) => getResultScore(r) === topScore)
    .map((r) => r.proposalId);
}

/**
 * Helper to get score from any result type
 */
function getResultScore(
  result: RankedChoiceResult | ApprovalVotingResult | SingleChoiceResult
): number {
  if ('totalPoints' in result) {
    return result.totalPoints;
  } else if ('approvalCount' in result) {
    return result.approvalCount;
  } else if ('yesVotes' in result) {
    return result.yesVotes;
  }
  return 0;
}

/**
 * Format voting results for display
 */
export function formatVotingResults(
  result: SingleChoiceResult | RankedChoiceResult | ApprovalVotingResult
): {
  winner: boolean;
  summary: string;
  details: string;
} {
  let summary = '';
  let details = '';
  let winner = false;

  if ('yesVotes' in result) {
    // Single Choice
    summary = `${result.yesVotes} Yes, ${result.noVotes} No (${result.percentage.toFixed(1)}%)`;
    details = `${result.totalVotes} total votes`;
    winner = result.percentage > 50;
  } else if ('totalPoints' in result) {
    // Ranked Choice
    summary = `${result.totalPoints} points (#${result.ranking})`;
    details = `1st: ${result.firstChoiceVotes}, 2nd: ${result.secondChoiceVotes}, 3rd: ${result.thirdChoiceVotes}`;
    winner = result.ranking === 1;
  } else if ('approvalCount' in result) {
    // Approval
    summary = `${result.approvalCount} approvals (${result.approvalPercentage.toFixed(1)}%)`;
    details = `Ranked #${result.ranking}`;
    winner = result.ranking === 1;
  }

  return { winner, summary, details };
}
