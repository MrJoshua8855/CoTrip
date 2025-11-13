'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { TripOverview } from '@/components/trips/TripOverview';
import { TripMembers } from '@/components/trips/TripMembers';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;

  const { data: trip, isLoading, error } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const response = await fetch('/api/trips/' + tripId);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have access to this trip');
        }
        throw new Error('Failed to fetch trip');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error instanceof Error ? error.message : 'Error loading trip'}
        </div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 mt-4"
        >
          <ArrowLeft size={20} />
          Back to Trips
        </Link>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          Trip not found
        </div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 mt-4"
        >
          <ArrowLeft size={20} />
          Back to Trips
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Trips
        </Link>

        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2">{trip.name}</h1>
          {trip.description && (
            <p className="text-gray-600">{trip.description}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TripOverview trip={trip} />
        </TabsContent>

        <TabsContent value="members">
          <TripMembers tripId={tripId} />
        </TabsContent>

        <TabsContent value="proposals">
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-500">
              Proposals feature coming soon! This will be implemented by Agent 3.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-500">
              Expenses feature coming soon! This will be implemented by Agent 4.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="lists">
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-500">
              Lists feature coming soon! This will be implemented by Agent 5.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
