import Link from 'next/link';
import { Calendar, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface TripCardProps {
  trip: {
    id: string;
    name: string;
    description?: string;
    destination?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    members: any[];
    _count: {
      proposals: number;
      expenses: number;
    };
  };
}

export function TripCard({ trip }: TripCardProps) {
  const getStatusBadge = () => {
    if (!trip.startDate || !trip.endDate) return null;

    const now = new Date();
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);

    if (now < start) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
          Upcoming
        </span>
      );
    } else if (now > end) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
          Past
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
          Ongoing
        </span>
      );
    }
  };

  return (
    <Link href={'/trips/' + trip.id}>
      <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer bg-white">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-semibold text-gray-900">{trip.name}</h3>
          {getStatusBadge()}
        </div>

        {trip.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {trip.description}
          </p>
        )}

        {trip.destination && (
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <MapPin size={16} />
            <span className="text-sm">{trip.destination}</span>
          </div>
        )}

        {trip.startDate && (
          <div className="flex items-center gap-2 text-gray-600 mb-3">
            <Calendar size={16} />
            <span className="text-sm">
              {format(new Date(trip.startDate), 'MMM d')}
              {trip.endDate &&
                ' - ' + format(new Date(trip.endDate), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600 mb-4">
          <Users size={16} />
          <span className="text-sm">{trip.members.length} members</span>
        </div>

        <div className="flex justify-between text-sm text-gray-500 pt-3 border-t">
          <span>{trip._count.proposals} proposals</span>
          <span>{trip._count.expenses} expenses</span>
        </div>
      </div>
    </Link>
  );
}
