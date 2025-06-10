
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
import { useState } from "react";

const ActiveTrip = () => {
  const navigate = useNavigate();
  const [tripCompleted, setTripCompleted] = useState(false);
  const [completedTripData, setCompletedTripData] = useState(null);

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

  const handleDistanceUpdate = (distance: number) => {
    console.log(`Distancia actualizada: ${distance.toFixed(2)} km`);
  };

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
          subtitle="Monitoreando su viaje actual"
        />

        <TripMetrics 
          driverName={activeTrip.driver?.name}
          cargoQuantity={activeTrip.cargo_weight || 0}
          elapsedTime={elapsedTime}
        />

        <LocationTracker 
          tripId={activeTrip.id} 
          onDistanceUpdate={handleDistanceUpdate}
        />

        <div className="w-full h-[400px] rounded-lg overflow-hidden">
          <MapView className="w-full h-full" />
        </div>

        <Button
          onClick={handleEndTrip}
          variant="default"
          className="w-full py-6 text-lg"
        >
          Finalizar Viaje
        </Button>
      </div>
    </div>
  );
};

export default ActiveTrip;
