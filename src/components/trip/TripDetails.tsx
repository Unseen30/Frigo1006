
import type { Trip } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, Clock, Route } from "lucide-react";

interface TripDetailsProps {
  trip: Trip;
}

export const TripDetails = ({ trip }: TripDetailsProps) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Detalles del Viaje</h3>
        <Badge variant={trip.status === 'completed' ? 'default' : 'secondary'}>
          {trip.status === 'completed' ? 'Completado' : 'Activo'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">Ruta</span>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Origen: {trip.origin}</div>
            <div>Destino: {trip.destination}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-medium">Tiempo</span>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Inicio: {formatDateTime(trip.start_time)}</div>
            {trip.end_time && (
              <div>Fin: {formatDateTime(trip.end_time)}</div>
            )}
            <div>Duración: {calculateDuration()}</div>
          </div>
        </Card>

        {trip.cargo_description && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-medium">Carga</span>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Tipo: {trip.cargo_description}</div>
              {trip.cargo_weight && (
                <div>Cantidad de Vacunos: {trip.cargo_weight}</div>
              )}
            </div>
          </Card>
        )}

        {trip.distance && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-4 h-4 text-primary" />
              <span className="font-medium text-primary">Kilómetros Recorridos</span>
            </div>
            <div className="text-lg font-bold text-primary">
              {trip.distance.toFixed(2)} km
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
