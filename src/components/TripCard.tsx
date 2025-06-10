
import { Card } from "@/components/ui/card";
import type { Trip } from "@/lib/types";
import { TripDriverInfo } from "./trip/TripDriverInfo";
import { TripDetails } from "./trip/TripDetails";
import { TripMap } from "./trip/TripMap";

interface TripCardProps {
  trip: Trip;
}

const TripCard = ({ trip }: TripCardProps) => {
  return (
    <Card className="p-6 space-y-4">
      <TripDriverInfo trip={trip} />
      <TripDetails trip={trip} />
      <TripMap trip={trip} />
    </Card>
  );
};

export default TripCard;
