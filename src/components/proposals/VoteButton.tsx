'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

interface VoteButtonProps {
  proposalId: string;
  votingType: string;
  currentVote?: {
    voteValue?: number | null;
    rank?: number | null;
  };
  onVoteSubmitted?: () => void;
}

export function VoteButton({
  proposalId,
  votingType,
  currentVote,
  onVoteSubmitted,
}: VoteButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVote, setSelectedVote] = useState<number | null>(
    currentVote?.voteValue ?? null
  );

  const handleSingleChoiceVote = async (voteValue: number) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voteValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit vote');
      }

      setSelectedVote(voteValue);
      toast.success('Vote submitted successfully');
      onVoteSubmitted?.();
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single Choice Voting UI
  if (votingType === 'single') {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => handleSingleChoiceVote(1)}
          disabled={isSubmitting}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-colors ${
            selectedVote === 1
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting && selectedVote === 1 ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <ThumbsUp size={20} />
          )}
          <span className="font-medium">Yes</span>
        </button>
        <button
          onClick={() => handleSingleChoiceVote(0)}
          disabled={isSubmitting}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-colors ${
            selectedVote === 0
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting && selectedVote === 0 ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <ThumbsDown size={20} />
          )}
          <span className="font-medium">No</span>
        </button>
      </div>
    );
  }

  // Ranked Choice and Approval voting require a different UI
  // These are typically handled at the trip level, not individual proposal level
  return (
    <div className="text-sm text-gray-600 text-center py-4">
      {votingType === 'ranked' && (
        <p>
          Ranked choice voting is done at the trip level. Go to the proposals page to
          rank multiple options.
        </p>
      )}
      {votingType === 'approval' && (
        <p>
          Approval voting is done at the trip level. Go to the proposals page to
          approve multiple options.
        </p>
      )}
    </div>
  );
}
