
import { Button } from "@/components/ui/button";
import RouteMap from "../RouteMap";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Trip } from "@/lib/types";

interface TripMapProps {
  trip: Trip;
}

export const TripMap = ({ trip }: TripMapProps) => {
  const [showMap, setShowMap] = useState(false);

  const { data: routePoints, isLoading } = useQuery({
    queryKey: ['routePoints', trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_points')
        .select('latitude, longitude')
        .eq('trip_id', trip.id)
        .order('timestamp', { ascending: true });

      if (error) {
        toast.error("Error al cargar los puntos de la ruta");
        throw error;
      }
      return data || [];
    },
    enabled: showMap,
  });

  if (trip.status !== "completed") return null;

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowMap(!showMap)}
      >
        {showMap ? "Ocultar Ruta" : "Ver Ruta"}
      </Button>
      
      {showMap && isLoading && (
        <div className="text-center py-4 text-gray-600">
          Cargando puntos de la ruta...
        </div>
      )}

      {showMap && !isLoading && (!routePoints || routePoints.length === 0) && (
        <div className="text-center py-4 text-gray-600">
          No hay puntos de ruta registrados para este viaje
        </div>
      )}
      
      {showMap && routePoints && routePoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Mostrando ruta con {routePoints.length} puntos registrados
          </p>
          <RouteMap routePoints={routePoints} />
        </div>
      )}
    </div>
  );
};
