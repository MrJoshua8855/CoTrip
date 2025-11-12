'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Filter, Loader2, Trophy, Award, Medal } from 'lucide-react';
import { ProposalCard } from './ProposalCard';
import { ProposalForm } from './ProposalForm';
import { formatVotingResults } from '@/lib/voting';

interface TripProposalsProps {
  tripId: string;
  currentUserId: string;
}

export function TripProposals({ tripId, currentUserId }: TripProposalsProps) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [rankedChoiceMode, setRankedChoiceMode] = useState(false);
  const [approvalMode, setApprovalMode] = useState(false);
  const [selectedRankings, setSelectedRankings] = useState<string[]>([]);
  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([]);
  const [isSubmittingVotes, setIsSubmittingVotes] = useState(false);

  // Fetch proposals
  const fetchProposals = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterCategory && filterCategory !== 'all') {
        params.append('category', filterCategory);
      }
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await fetch(`/api/trips/${tripId}/proposals?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch proposals');
      }

      const data = await response.json();
      setProposals(data);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [tripId, filterCategory, filterStatus]);

  // Group proposals by category
  const proposalsByCategory = proposals.reduce((acc, proposal) => {
    if (!acc[proposal.category]) {
      acc[proposal.category] = [];
    }
    acc[proposal.category].push(proposal);
    return acc;
  }, {} as Record<string, any[]>);

  // Get open proposals for ranked/approval voting
  const getOpenProposalsByCategory = (category: string) => {
    return proposals.filter(
      (p) => p.category === category && p.status === 'open'
    );
  };

  // Handle ranked choice voting
  const handleRankedVoting = (category: string) => {
    setSelectedCategory(category);
    setRankedChoiceMode(true);
    setApprovalMode(false);

    // Load existing rankings for this category
    const categoryProposals = getOpenProposalsByCategory(category);
    const userVotes = categoryProposals
      .filter((p) => p.votes?.some((v: any) => v.user?.id === currentUserId && v.rank))
      .sort((a: any, b: any) => {
        const aRank = a.votes.find((v: any) => v.user?.id === currentUserId)?.rank || 999;
        const bRank = b.votes.find((v: any) => v.user?.id === currentUserId)?.rank || 999;
        return aRank - bRank;
      })
      .map((p) => p.id);

    setSelectedRankings(userVotes);
  };

  // Handle approval voting
  const handleApprovalVoting = (category: string) => {
    setSelectedCategory(category);
    setApprovalMode(true);
    setRankedChoiceMode(false);

    // Load existing approvals for this category
    const categoryProposals = getOpenProposalsByCategory(category);
    const userApprovals = categoryProposals
      .filter((p) =>
        p.votes?.some((v: any) => v.user?.id === currentUserId && v.voteValue === 1)
      )
      .map((p) => p.id);

    setSelectedApprovals(userApprovals);
  };

  // Submit ranked votes
  const submitRankedVotes = async () => {
    if (selectedRankings.length === 0) {
      toast.error('Please select at least one proposal to rank');
      return;
    }

    try {
      setIsSubmittingVotes(true);

      // Submit votes for each ranked proposal
      const firstProposal = proposals.find((p) => p.id === selectedRankings[0]);
      if (!firstProposal) return;

      const response = await fetch(`/api/proposals/${firstProposal.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalIds: selectedRankings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit rankings');
      }

      toast.success('Rankings submitted successfully');
      setRankedChoiceMode(false);
      setSelectedRankings([]);
      fetchProposals();
    } catch (error) {
      console.error('Error submitting rankings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit rankings');
    } finally {
      setIsSubmittingVotes(false);
    }
  };

  // Submit approval votes
  const submitApprovalVotes = async () => {
    if (selectedApprovals.length === 0) {
      toast.error('Please approve at least one proposal');
      return;
    }

    try {
      setIsSubmittingVotes(true);

      const firstProposal = proposals.find((p) => p.id === selectedApprovals[0]);
      if (!firstProposal) return;

      const response = await fetch(`/api/proposals/${firstProposal.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalIds: selectedApprovals,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit approvals');
      }

      toast.success('Approvals submitted successfully');
      setApprovalMode(false);
      setSelectedApprovals([]);
      fetchProposals();
    } catch (error) {
      console.error('Error submitting approvals:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit approvals');
    } finally {
      setIsSubmittingVotes(false);
    }
  };

  // Render ranked choice interface
  const renderRankedChoiceInterface = () => {
    const categoryProposals = getOpenProposalsByCategory(selectedCategory);

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Rank Your Top 3 Choices for {selectedCategory}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Click proposals to rank them (1st choice = 3 points, 2nd = 2 points, 3rd = 1
          point)
        </p>

        <div className="space-y-4 mb-4">
          {[1, 2, 3].map((rank) => {
            const proposalId = selectedRankings[rank - 1];
            const proposal = proposals.find((p) => p.id === proposalId);

            return (
              <div key={rank} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white font-bold">
                  {rank}
                </div>
                {proposal ? (
                  <div className="flex-1 p-3 bg-white border border-blue-300 rounded-md flex justify-between items-center">
                    <span className="font-medium">{proposal.title}</span>
                    <button
                      onClick={() =>
                        setSelectedRankings(selectedRankings.filter((id) => id !== proposalId))
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-400 text-center">
                    Click a proposal below to assign rank {rank}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {categoryProposals
            .filter((p) => !selectedRankings.includes(p.id))
            .map((proposal) => (
              <button
                key={proposal.id}
                onClick={() => {
                  if (selectedRankings.length < 3) {
                    setSelectedRankings([...selectedRankings, proposal.id]);
                  } else {
                    toast.error('You can only rank up to 3 proposals');
                  }
                }}
                className="p-4 bg-white border border-gray-300 rounded-md hover:border-blue-500 hover:shadow-md transition-all text-left"
              >
                <h4 className="font-medium">{proposal.title}</h4>
                {proposal.price && (
                  <p className="text-sm text-gray-600 mt-1">
                    {proposal.currency} {proposal.price}
                  </p>
                )}
              </button>
            ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setRankedChoiceMode(false);
              setSelectedRankings([]);
            }}
            disabled={isSubmittingVotes}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={submitRankedVotes}
            disabled={isSubmittingVotes || selectedRankings.length === 0}
            className="flex-1 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmittingVotes && <Loader2 className="animate-spin" size={16} />}
            Submit Rankings
          </button>
        </div>
      </div>
    );
  };

  // Render approval voting interface
  const renderApprovalInterface = () => {
    const categoryProposals = getOpenProposalsByCategory(selectedCategory);

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Approve Options for {selectedCategory}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Select all proposals you would be happy with
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {categoryProposals.map((proposal) => {
            const isApproved = selectedApprovals.includes(proposal.id);

            return (
              <button
                key={proposal.id}
                onClick={() => {
                  if (isApproved) {
                    setSelectedApprovals(
                      selectedApprovals.filter((id) => id !== proposal.id)
                    );
                  } else {
                    setSelectedApprovals([...selectedApprovals, proposal.id]);
                  }
                }}
                className={`p-4 border-2 rounded-md transition-all text-left ${
                  isApproved
                    ? 'bg-green-100 border-green-500'
                    : 'bg-white border-gray-300 hover:border-green-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{proposal.title}</h4>
                  {isApproved && (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                      ✓
                    </div>
                  )}
                </div>
                {proposal.price && (
                  <p className="text-sm text-gray-600">
                    {proposal.currency} {proposal.price}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setApprovalMode(false);
              setSelectedApprovals([]);
            }}
            disabled={isSubmittingVotes}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={submitApprovalVotes}
            disabled={isSubmittingVotes || selectedApprovals.length === 0}
            className="flex-1 px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmittingVotes && <Loader2 className="animate-spin" size={16} />}
            Submit Approvals ({selectedApprovals.length})
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Proposals</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          <Plus size={20} />
          New Proposal
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="accommodation">Accommodation</option>
          <option value="activity">Activity</option>
          <option value="dining">Dining</option>
          <option value="transportation">Transportation</option>
          <option value="other">Other</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="selected">Selected</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Proposal</h3>
          <ProposalForm
            tripId={tripId}
            onSuccess={() => {
              setShowCreateForm(false);
              fetchProposals();
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {/* Ranked choice interface */}
      {rankedChoiceMode && renderRankedChoiceInterface()}

      {/* Approval voting interface */}
      {approvalMode && renderApprovalInterface()}

      {/* Proposals by category */}
      {Object.keys(proposalsByCategory).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No proposals yet. Create one to get started!</p>
        </div>
      ) : (
        Object.entries(proposalsByCategory).map(([category, categoryProposals]) => {
          const openProposals = categoryProposals.filter((p) => p.status === 'open');
          const hasRankedChoice = openProposals.some((p) => p.votingType === 'ranked');
          const hasApproval = openProposals.some((p) => p.votingType === 'approval');

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold capitalize">{category}</h3>
                {openProposals.length > 0 && (
                  <div className="flex gap-2">
                    {hasRankedChoice && (
                      <button
                        onClick={() => handleRankedVoting(category)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                      >
                        Rank Choices
                      </button>
                    )}
                    {hasApproval && (
                      <button
                        onClick={() => handleApprovalVoting(category)}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                      >
                        Approve Options
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    currentUserId={currentUserId}
                    onVote={fetchProposals}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
