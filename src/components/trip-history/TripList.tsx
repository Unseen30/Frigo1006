import TripCard from "@/components/TripCard";
import type { Trip } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface TripListProps {
  trips: Trip[];
  isLoading: boolean;
}

export const TripList = ({ trips, isLoading }: TripListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay viajes registrados en el período seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
};