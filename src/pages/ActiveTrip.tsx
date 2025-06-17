
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import MapView from "@/components/MapView";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LocationTracker } from "@/components/LocationTracker";
import { TripHeader } from "@/components/trip/TripHeader";
import { TripMetrics } from "@/components/trip/TripMetrics";
import { TripSummary } from "@/components/trip/TripSummary";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { useState, useEffect } from "react";
import { getRoutePoints as getCachedRoutePoints } from "@/utils/routeCache";
import { Card } from "@/components/ui/card";
import { RouteCacheManager } from "@/components/RouteCacheManager";

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
}

const ActiveTrip = () => {
  const navigate = useNavigate();
  const [tripCompleted, setTripCompleted] = useState(false);
  const [completedTripData, setCompletedTripData] = useState(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState(0);

  const { data: activeTrip, isError, error } = useQuery({
    queryKey: ["activeTrip"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(`
          *,
          driver:drivers(*)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) {
        console.error("Error fetching active trip:", error);
        toast.error("Error al cargar el viaje activo");
        throw error;
      }

      if (!data) {
        console.log("No active trip found");
        navigate("/home");
        return null;
      }

      return data;
    },
    retry: false,
  });

  const elapsedTime = useElapsedTime(activeTrip?.start_time);

  const handleEndTrip = async () => {
    if (!activeTrip) return;

    try {
      const { data: updatedTrip, error } = await supabase
        .from("trips")
        .update({
          end_time: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", activeTrip.id)
        .select(`
          *,
          driver:drivers(*)
        `)
        .single();

      if (error) throw error;

      setCompletedTripData(updatedTrip);
      setTripCompleted(true);
      toast.success("Viaje completado exitosamente");
    } catch (error: any) {
      console.error("Error ending trip:", error);
      toast.error("Error al finalizar el viaje");
    }
  };

  const handleDistanceUpdate = (newDistance: number) => {
    setDistance(newDistance);
  };

  // Cargar puntos de ruta guardados
  const loadRoutePoints = async () => {
    if (!activeTrip?.id) return;
    
    try {
      const points = await getCachedRoutePoints(activeTrip.id);
      setRoutePoints(points);
      
      // Actualizar la posición actual con el último punto
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        setCurrentPosition({
          lat: lastPoint.latitude,
          lng: lastPoint.longitude
        });
      }
    } catch (error) {
      console.error('Error al cargar puntos de ruta:', error);
    }
  };

  // Cargar puntos de ruta cuando cambia el viaje activo
  useEffect(() => {
    if (activeTrip?.id) {
      loadRoutePoints();
      
      // Configurar actualización periódica de la ruta
      const interval = setInterval(loadRoutePoints, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTrip?.id]);

  if (isError) {
    console.error("Query error:", error);
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
          <p className="text-gray-600 mb-4">Hubo un error al cargar el viaje activo</p>
          <Button variant="outline" onClick={() => navigate("/home")}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  if (!activeTrip) return null;

  // Mostrar resumen del viaje completado
  if (tripCompleted && completedTripData) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          <TripHeader 
            title="¡Viaje Completado!"
            subtitle="Resumen del viaje finalizado"
          />

          <TripSummary trip={completedTripData} />

          <div className="flex gap-4">
            <Button
              onClick={() => navigate("/history")}
              variant="default"
              className="flex-1 py-6 text-lg"
            >
              Ver Historial
            </Button>
            <Button
              onClick={() => navigate("/home")}
              variant="outline"
              className="flex-1 py-6 text-lg"
            >
              Nuevo Viaje
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        <TripHeader 
          title="Viaje Activo"
          subtitle={`${activeTrip.origin} → ${activeTrip.destination}`}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Detalles del Viaje</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Origen:</span> {activeTrip.origin}</p>
                <p><span className="font-medium">Destino:</span> {activeTrip.destination}</p>
                <p><span className="font-medium">Distancia:</span> {activeTrip.distance} km</p>
                <p><span className="font-medium">Tiempo transcurrido:</span> {elapsedTime}</p>
              </div>
            </div>

            {/* Gestor de Caché de Ruta */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Gestión de Ruta</h3>
              <div className="space-y-4">
                <RouteCacheManager 
                  tripId={activeTrip.id}
                  onSyncComplete={(count) => {
                    if (count > 0) {
                      toast.success(`${count} puntos de ruta sincronizados`);
                    }
                  }} 
                />
              </div>
            </Card>
          </div>

          <div className="w-full h-[400px] rounded-lg overflow-hidden bg-gray-100">
            <MapView 
              className="w-full h-full" 
              routePoints={routePoints}
              currentPosition={currentPosition}
            />
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <LocationTracker 
            tripId={activeTrip.id} 
            onDistanceUpdate={handleDistanceUpdate}
          />
          
          <Button
            onClick={handleEndTrip}
            variant="default"
            className="w-full py-6 text-lg"
          >
            Finalizar Viaje
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActiveTrip;
