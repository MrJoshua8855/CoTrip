'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface TripMembersProps {
  tripId: string;
}

export function TripMembers({ tripId }: TripMembersProps) {
  const queryClient = useQueryClient();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [error, setError] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const response = await fetch('/api/trips/' + tripId + '/members');
      if (!response.ok) throw new Error('Failed to fetch members');
      return response.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await fetch('/api/trips/' + tripId + '/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('member');
      setError('');
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch('/api/trips/' + tripId + '/members/' + userId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/trips/' + tripId + '/members/' + userId, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteEmail.trim()) {
      setError('Email is required');
      return;
    }

    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      organizer: 'bg-blue-100 text-blue-800',
      member: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={'px-2 py-1 text-xs font-semibold rounded ' + (roleColors[role] || 'bg-gray-100 text-gray-800')}>
        {role.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      invited: 'bg-yellow-100 text-yellow-800',
      declined: 'bg-red-100 text-red-800',
    };

    return (
      <span className={'px-2 py-1 text-xs font-semibold rounded ' + (statusColors[status] || 'bg-gray-100 text-gray-800')}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trip Members</h2>
        <button
          onClick={() => setShowInviteDialog(true)}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          <UserPlus size={20} />
          Invite Member
        </button>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {members?.map((member: any) => (
          <div
            key={member.id}
            className="p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                {member.user.avatarUrl ? (
                  <img
                    src={member.user.avatarUrl}
                    alt={member.user.fullName || member.user.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <span className="text-gray-600 font-semibold">
                    {(member.user.fullName || member.user.username || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="font-semibold">
                  {member.user.fullName || member.user.username}
                </p>
                <p className="text-sm text-gray-500">{member.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(member.status)}
              
              <select
                value={member.role}
                onChange={(e) =>
                  updateRoleMutation.mutate({
                    userId: member.userId,
                    role: e.target.value,
                  })
                }
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={updateRoleMutation.isPending}
              >
                <option value="owner">Owner</option>
                <option value="organizer">Organizer</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>

              <button
                onClick={() => {
                  if (
                    confirm('Are you sure you want to remove this member?')
                  ) {
                    removeMemberMutation.mutate(member.userId);
                  }
                }}
                className="text-red-600 hover:text-red-800 p-1"
                disabled={removeMemberMutation.isPending}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {members?.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No members yet. Invite someone to join this trip!
          </div>
        )}
      </div>

      {showInviteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Invite Member</h3>
              <button
                onClick={() => {
                  setShowInviteDialog(false);
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="friend@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer (Read Only)</option>
                  <option value="member">Member (Can contribute)</option>
                  <option value="organizer">Organizer (Can edit)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteDialog(false);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
