'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, ExternalLink, Calendar, MapPin, DollarSign } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { VoteButton } from './VoteButton';

interface ProposalCardProps {
  proposal: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    url?: string | null;
    price?: number | null;
    currency: string;
    location?: string | null;
    votingType: string;
    votingDeadline?: Date | string | null;
    status: string;
    metadata?: any;
    proposedBy?: {
      id: string;
      fullName: string | null;
      username: string;
      avatarUrl?: string | null;
    } | null;
    votes?: Array<{
      id: string;
      voteValue?: number | null;
      rank?: number | null;
      user?: {
        id: string;
        fullName: string | null;
        username: string;
      };
    }>;
    _count?: {
      votes: number;
      comments: number;
    };
  };
  currentUserId?: string;
  onVote?: () => void;
}

export function ProposalCard({ proposal, currentUserId, onVote }: ProposalCardProps) {
  const [showVoting, setShowVoting] = useState(false);

  // Calculate vote counts
  const yesVotes = proposal.votes?.filter((v) => v.voteValue === 1).length || 0;
  const noVotes = proposal.votes?.filter((v) => v.voteValue === 0).length || 0;
  const totalVotes = proposal._count?.votes || proposal.votes?.length || 0;

  // Check if deadline has passed
  const deadline = proposal.votingDeadline ? new Date(proposal.votingDeadline) : null;
  const isVotingClosed =
    proposal.status !== 'open' || (deadline && deadline < new Date());

  // Get user's vote if exists
  const userVote = proposal.votes?.find((v) => v.user?.id === currentUserId);

  // Format category badge color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      accommodation: 'bg-blue-100 text-blue-800',
      activity: 'bg-green-100 text-green-800',
      dining: 'bg-orange-100 text-orange-800',
      transportation: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.other;
  };

  // Format status badge color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      selected: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.open;
  };

  // Get link preview image
  const imageUrl = proposal.metadata?.linkData?.imageUrl;

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image preview if available */}
      {imageUrl && (
        <div className="relative w-full h-48 bg-gray-200">
          <img
            src={imageUrl}
            alt={proposal.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-block px-2 py-1 text-xs rounded ${getCategoryColor(
                  proposal.category
                )}`}
              >
                {proposal.category}
              </span>
              <span
                className={`inline-block px-2 py-1 text-xs rounded ${getStatusColor(
                  proposal.status
                )}`}
              >
                {proposal.status}
              </span>
              {proposal.votingType !== 'single' && (
                <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                  {proposal.votingType === 'ranked' ? 'Ranked Choice' : 'Approval'}
                </span>
              )}
            </div>
            <h3 className="text-xl font-semibold mb-1">{proposal.title}</h3>
            {proposal.proposedBy && (
              <p className="text-sm text-gray-500">
                Proposed by {proposal.proposedBy.fullName || proposal.proposedBy.username}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {proposal.description && (
          <p className="text-gray-600 mb-4 line-clamp-3">{proposal.description}</p>
        )}

        {/* Details */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {proposal.price && (
            <div className="flex items-center gap-1 text-sm text-gray-700">
              <DollarSign size={16} />
              <span className="font-semibold">
                {proposal.currency} {proposal.price.toLocaleString()}
              </span>
            </div>
          )}
          {proposal.location && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin size={16} />
              <span>{proposal.location}</span>
            </div>
          )}
          {proposal.url && (
            <a
              href={proposal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
            >
              View Details <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Voting deadline */}
        {deadline && (
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-4">
            <Calendar size={16} />
            <span>
              {isVotingClosed
                ? `Voting closed ${formatDistanceToNow(deadline, { addSuffix: true })}`
                : `Vote by ${format(deadline, 'MMM d, yyyy h:mm a')}`}
            </span>
          </div>
        )}

        {/* Vote counts and actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-6">
            {proposal.votingType === 'single' && (
              <>
                <div className="flex items-center gap-2 text-gray-600">
                  <ThumbsUp size={18} className={yesVotes > 0 ? 'text-green-600' : ''} />
                  <span className="font-semibold">{yesVotes}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <ThumbsDown size={18} className={noVotes > 0 ? 'text-red-600' : ''} />
                  <span className="font-semibold">{noVotes}</span>
                </div>
              </>
            )}
            {(proposal.votingType === 'ranked' || proposal.votingType === 'approval') && (
              <div className="flex items-center gap-2 text-gray-600">
                <ThumbsUp size={18} />
                <span className="font-semibold">{totalVotes} votes</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <MessageSquare size={18} />
              <span>{proposal._count?.comments || 0}</span>
            </div>
          </div>

          {!isVotingClosed && (
            <button
              onClick={() => setShowVoting(!showVoting)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                userVote
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {userVote ? 'Update Vote' : 'Vote'}
            </button>
          )}
        </div>

        {/* Voting interface */}
        {showVoting && !isVotingClosed && (
          <div className="mt-4 pt-4 border-t">
            <VoteButton
              proposalId={proposal.id}
              votingType={proposal.votingType}
              currentVote={userVote}
              onVoteSubmitted={() => {
                setShowVoting(false);
                onVote?.();
              }}
            />
          </div>
        )}

        {/* Show results if voting is closed */}
        {isVotingClosed && proposal.status === 'closed' && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Voting closed. View full results for details.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
