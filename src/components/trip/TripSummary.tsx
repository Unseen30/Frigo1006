
import type { Trip } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Route, MapPin, Clock, Package } from "lucide-react";

interface TripSummaryProps {
  trip: Trip;
}

export const TripSummary = ({ trip }: TripSummaryProps) => {
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = () => {
    const start = new Date(trip.start_time);
    const end = trip.end_time ? new Date(trip.end_time) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Kilómetros recorridos destacados */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Route className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-primary">Kilómetros Recorridos</h2>
          </div>
          <div className="text-4xl font-bold text-primary">
            {trip.distance ? trip.distance.toFixed(2) : '0.00'} km
          </div>
          <p className="text-sm text-gray-600">Distancia total del viaje</p>
        </div>
      </Card>

      {/* Resumen del viaje */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">Ruta</span>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="truncate">De: {trip.origin}</div>
            <div className="truncate">A: {trip.destination}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-medium">Duración</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {calculateDuration()}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-primary" />
            <span className="font-medium">Carga</span>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div>{trip.cargo_description || 'No especificado'}</div>
            {trip.cargo_weight && (
              <div className="font-medium">Cantidad: {trip.cargo_weight} vacunos</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
