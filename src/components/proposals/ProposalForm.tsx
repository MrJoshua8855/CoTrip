'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { Loader2, ExternalLink } from 'lucide-react';
import { parseAccommodationLink, getProviderFromUrl } from '@/lib/linkParser';

// Form validation schema
const proposalSchema = z.object({
  category: z.enum(['accommodation', 'activity', 'transportation', 'dining', 'other']),
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().optional(),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  price: z.number().min(0, 'Price must be positive').optional(),
  currency: z.string().default('USD'),
  location: z.string().optional(),
  votingType: z.enum(['single', 'ranked', 'approval']).default('single'),
  votingDeadline: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface ProposalFormProps {
  tripId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProposalForm({ tripId, onSuccess, onCancel }: ProposalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      category: 'accommodation',
      currency: 'USD',
      votingType: 'single',
    },
  });

  const url = watch('url');

  // Parse link when URL changes
  const handleLinkParse = async () => {
    if (!url) {
      setLinkPreview(null);
      return;
    }

    try {
      setIsParsingLink(true);
      const metadata = await parseAccommodationLink(url);
      setLinkPreview(metadata);

      // Auto-fill fields if not already set
      if (metadata.title && !watch('title')) {
        setValue('title', metadata.title);
      }
      if (metadata.price && !watch('price')) {
        setValue('price', metadata.price);
      }
      if (metadata.location && !watch('location')) {
        setValue('location', metadata.location);
      }
      if (metadata.currency) {
        setValue('currency', metadata.currency);
      }

      toast.success('Link parsed successfully');
    } catch (error) {
      console.error('Error parsing link:', error);
      toast.error('Could not parse link');
    } finally {
      setIsParsingLink(false);
    }
  };

  // Submit form
  const onSubmit = async (data: ProposalFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/trips/${tripId}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          price: data.price ? Number(data.price) : undefined,
          votingDeadline: data.votingDeadline
            ? new Date(data.votingDeadline).toISOString()
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create proposal');
      }

      const proposal = await response.json();
      toast.success('Proposal created successfully');
      onSuccess?.();
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category *
        </label>
        <select
          {...register('category')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="accommodation">Accommodation</option>
          <option value="activity">Activity</option>
          <option value="dining">Dining</option>
          <option value="transportation">Transportation</option>
          <option value="other">Other</option>
        </select>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title *
        </label>
        <input
          type="text"
          {...register('title')}
          placeholder="e.g., Beachfront Airbnb"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Add details about this proposal..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL (optional)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            {...register('url')}
            placeholder="https://airbnb.com/..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleLinkParse}
            disabled={!url || isParsingLink}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsingLink ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Parse'
            )}
          </button>
        </div>
        {errors.url && (
          <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
        )}
        {linkPreview && linkPreview.source !== 'invalid' && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink size={16} />
              <span className="font-medium">
                {getProviderFromUrl(url || '')}
              </span>
              {linkPreview.listingId && (
                <span className="text-gray-600">
                  ID: {linkPreview.listingId}
                </span>
              )}
            </div>
            {linkPreview.title && (
              <p className="mt-1 text-sm text-gray-700">{linkPreview.title}</p>
            )}
          </div>
        )}
      </div>

      {/* Price and Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price (optional)
          </label>
          <input
            type="number"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <input
            type="text"
            {...register('currency')}
            placeholder="USD"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.currency && (
            <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>
          )}
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location (optional)
        </label>
        <input
          type="text"
          {...register('location')}
          placeholder="e.g., Malibu, CA"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.location && (
          <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
        )}
      </div>

      {/* Voting Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Voting Type
        </label>
        <select
          {...register('votingType')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="single">Single Choice (Yes/No)</option>
          <option value="ranked">Ranked Choice (Top 3)</option>
          <option value="approval">Approval Voting (Multiple Choice)</option>
        </select>
        {errors.votingType && (
          <p className="mt-1 text-sm text-red-600">{errors.votingType.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {watch('votingType') === 'single' && 'Each member votes yes or no'}
          {watch('votingType') === 'ranked' &&
            'Members rank their top 3 choices (3 points for 1st, 2 for 2nd, 1 for 3rd)'}
          {watch('votingType') === 'approval' &&
            'Members can approve multiple proposals'}
        </p>
      </div>

      {/* Voting Deadline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Voting Deadline (optional)
        </label>
        <input
          type="datetime-local"
          {...register('votingDeadline')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.votingDeadline && (
          <p className="mt-1 text-sm text-red-600">{errors.votingDeadline.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={16} />}
          {isSubmitting ? 'Creating...' : 'Create Proposal'}
        </button>
      </div>
    </form>
  );
}
