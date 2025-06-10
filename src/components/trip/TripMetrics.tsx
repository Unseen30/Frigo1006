
import { MapPin, Clock, Truck } from "lucide-react";

interface TripMetricsProps {
  driverName: string;
  cargoQuantity: number;
  elapsedTime: number;
}

export const TripMetrics = ({ driverName, cargoQuantity, elapsedTime }: TripMetricsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-3">
        <Truck className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm text-gray-600">Conductor</p>
          <p className="font-medium">{driverName}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-3">
        <MapPin className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm text-gray-600">Carga</p>
          <p className="font-medium">{cargoQuantity} vacunos</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-3">
        <Clock className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm text-gray-600">Duración</p>
          <p className="font-medium">
            {Math.floor(elapsedTime / 3600)}h{" "}
            {Math.floor((elapsedTime % 3600) / 60)}m
          </p>
        </div>
      </div>
    </div>
  );
};
