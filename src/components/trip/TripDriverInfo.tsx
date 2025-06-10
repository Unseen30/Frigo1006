
import type { Trip } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { User, Truck } from "lucide-react";

interface TripDriverInfoProps {
  trip: Trip;
}

export const TripDriverInfo = ({ trip }: TripDriverInfoProps) => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {trip.driver?.name || "Conductor no especificado"}
            </h3>
            <p className="text-gray-600 text-sm">Conductor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600">
          <Truck className="w-4 h-4" />
          <span className="text-sm">
            {(trip as any).truck?.plate_number || "Sin matrícula"}
          </span>
        </div>
      </div>
    </Card>
  );
};
