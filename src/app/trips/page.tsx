'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { CreateTripDialog } from '@/components/trips/CreateTripDialog';
import { TripCard } from '@/components/trips/TripCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function TripsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const response = await fetch('/api/trips');
      if (!response.ok) throw new Error('Failed to fetch trips');
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading trips. Please try again later.
        </div>
      </div>
    );
  }

  const now = new Date();

  const upcomingTrips = trips?.filter((trip: any) => {
    if (!trip.startDate) return false;
    return new Date(trip.startDate) > now;
  }) || [];

  const ongoingTrips = trips?.filter((trip: any) => {
    if (!trip.startDate || !trip.endDate) return false;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return start <= now && now <= end;
  }) || [];

  const pastTrips = trips?.filter((trip: any) => {
    if (!trip.endDate) return false;
    return new Date(trip.endDate) < now;
  }) || [];

  const plannedTrips = trips?.filter((trip: any) => {
    return !trip.startDate && !trip.endDate;
  }) || [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Trips</h1>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          <Plus size={20} />
          New Trip
        </button>
      </div>

      {trips?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500 mb-4 text-lg">No trips yet</p>
          <p className="text-gray-400 mb-6">
            Create your first trip to start planning your adventure!
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="text-blue-500 hover:text-blue-600 font-semibold"
          >
            Create your first trip
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {ongoingTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-green-700">
                Ongoing Trips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ongoingTrips.map((trip: any) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {upcomingTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-blue-700">
                Upcoming Trips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTrips.map((trip: any) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {plannedTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-700">
                Planning
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plannedTrips.map((trip: any) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {pastTrips.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-gray-500">
                Past Trips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastTrips.map((trip: any) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateTripDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
