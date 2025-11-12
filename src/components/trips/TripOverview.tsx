'use client';

import { format } from 'date-fns';
import { Calendar, MapPin, DollarSign, Users, FileText, List } from 'lucide-react';
import Link from 'next/link';

interface TripOverviewProps {
  trip: {
    id: string;
    name: string;
    description?: string;
    destination?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    status: string;
    currency: string;
    totalBudget?: number;
    costStructure?: string;
    members: any[];
    subTrips?: any[];
    parentTrip?: {
      id: string;
      name: string;
      destination?: string;
    };
    _count: {
      proposals: number;
      expenses: number;
      listItems: number;
      settlements: number;
    };
  };
}

export function TripOverview({ trip }: TripOverviewProps) {
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      planning: 'bg-yellow-100 text-yellow-800',
      booked: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };

    return (
      <span className={'px-3 py-1 text-sm font-semibold rounded-full ' + (statusColors[status] || 'bg-gray-100 text-gray-800')}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {trip.parentTrip && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            This is a sub-trip of{' '}
            <Link
              href={'/trips/' + trip.parentTrip.id}
              className="font-semibold hover:underline"
            >
              {trip.parentTrip.name}
            </Link>
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Trip Details</h2>
          {getStatusBadge(trip.status)}
        </div>

        {trip.description && (
          <p className="text-gray-600 mb-4">{trip.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trip.destination && (
            <div className="flex items-center gap-3">
              <MapPin className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-medium">{trip.destination}</p>
              </div>
            </div>
          )}

          {trip.startDate && (
            <div className="flex items-center gap-3">
              <Calendar className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-500">Dates</p>
                <p className="font-medium">
                  {format(new Date(trip.startDate), 'MMM d, yyyy')}
                  {trip.endDate && ' - ' + format(new Date(trip.endDate), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Users className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-500">Members</p>
              <p className="font-medium">{trip.members.length} people</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DollarSign className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-500">Currency</p>
              <p className="font-medium">{trip.currency}</p>
            </div>
          </div>

          {trip.totalBudget && (
            <div className="flex items-center gap-3">
              <DollarSign className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-500">Total Budget</p>
                <p className="font-medium">
                  {trip.currency} {trip.totalBudget.toString()}
                </p>
              </div>
            </div>
          )}

          {trip.costStructure && (
            <div className="flex items-center gap-3">
              <FileText className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-500">Cost Structure</p>
                <p className="font-medium">
                  {trip.costStructure.replace('_', ' ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Proposals</p>
              <p className="text-3xl font-bold mt-1">{trip._count.proposals}</p>
            </div>
            <FileText className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Expenses</p>
              <p className="text-3xl font-bold mt-1">{trip._count.expenses}</p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">List Items</p>
              <p className="text-3xl font-bold mt-1">{trip._count.listItems}</p>
            </div>
            <List className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Settlements</p>
              <p className="text-3xl font-bold mt-1">{trip._count.settlements}</p>
            </div>
            <DollarSign className="text-orange-500" size={32} />
          </div>
        </div>
      </div>

      {trip.subTrips && trip.subTrips.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-xl font-semibold mb-4">Sub-Trips</h3>
          <div className="space-y-3">
            {trip.subTrips.map((subTrip) => (
              <Link
                key={subTrip.id}
                href={'/trips/' + subTrip.id}
                className="block p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{subTrip.name}</h4>
                    {subTrip.destination && (
                      <p className="text-sm text-gray-500">
                        {subTrip.destination}
                      </p>
                    )}
                  </div>
                  {subTrip.startDate && (
                    <span className="text-sm text-gray-500">
                      {format(new Date(subTrip.startDate), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
