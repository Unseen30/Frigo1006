
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LocationTrackerProps {
  tripId: string;
  onDistanceUpdate?: (distance: number) => void;
}

export const LocationTracker = ({ tripId, onDistanceUpdate }: LocationTrackerProps) => {
  const [tracking, setTracking] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const totalDistance = useRef<number>(0);

  // Fórmula de Haversine para calcular distancia entre dos puntos GPS
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en kilómetros
  };

  const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const handlePositionUpdate = async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Filtrar lecturas con baja precisión (más de 50 metros de error)
    if (accuracy > 50) {
      console.log(`Posición descartada por baja precisión: ${accuracy}m`);
      return;
    }
    
    try {
      // Guardar el punto en la base de datos
      const { error } = await supabase
        .from('route_points')
        .insert({
          trip_id: tripId,
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      // Calcular la distancia usando Haversine si hay una posición anterior
      if (lastPosition.current) {
        const distanceSegment = calculateHaversineDistance(
          lastPosition.current.coords.latitude,
          lastPosition.current.coords.longitude,
          latitude,
          longitude
        );
        
        // Solo agregar la distancia si el movimiento es significativo (más de 10 metros)
        if (distanceSegment > 0.01) { // 0.01 km = 10 metros
          totalDistance.current += distanceSegment;
          onDistanceUpdate?.(totalDistance.current);

          // Actualizar la distancia en la tabla de viajes
          const { error: updateError } = await supabase
            .from('trips')
            .update({ distance: totalDistance.current })
            .eq('id', tripId);

          if (updateError) throw updateError;

          console.log(`Distancia agregada: ${distanceSegment.toFixed(3)} km - Total: ${totalDistance.current.toFixed(2)} km`);
        }
      }

      lastPosition.current = position;

    } catch (error: any) {
      console.error('Error al guardar la ubicación:', error);
      toast.error('Error al actualizar la ubicación');
    }
  };

  useEffect(() => {
    if (!tripId) return;

    const startTracking = () => {
      if (!navigator.geolocation) {
        toast.error('Geolocalización no disponible en este dispositivo');
        return;
      }

      // Obtener la posición inicial y distancia acumulada
      const initializeDistance = async () => {
        try {
          const { data: existingPoints, error } = await supabase
            .from('route_points')
            .select('latitude, longitude')
            .eq('trip_id', tripId)
            .order('timestamp', { ascending: true });

          if (error) throw error;

          if (existingPoints && existingPoints.length > 1) {
            let accumulatedDistance = 0;
            
            for (let i = 1; i < existingPoints.length; i++) {
              const distance = calculateHaversineDistance(
                existingPoints[i-1].latitude,
                existingPoints[i-1].longitude,
                existingPoints[i].latitude,
                existingPoints[i].longitude
              );
              accumulatedDistance += distance;
            }
            
            totalDistance.current = accumulatedDistance;
            onDistanceUpdate?.(totalDistance.current);
            console.log(`Distancia inicial recuperada: ${totalDistance.current.toFixed(2)} km`);
          }
        } catch (error) {
          console.error('Error al recuperar puntos existentes:', error);
        }
      };

      initializeDistance();

      watchId.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
          console.error('Error de geolocalización:', error);
          toast.error('Error al obtener la ubicación');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000 // Permitir ubicaciones de hasta 30 segundos de antigüedad
        }
      );

      setTracking(true);
      toast.success('Seguimiento de ubicación iniciado con cálculo Haversine');
    };

    startTracking();

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setTracking(false);
      }
    };
  }, [tripId]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${tracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-gray-600">
        {tracking ? 'Tracking GPS activo (Haversine)' : 'Tracking inactivo'}
      </span>
      {totalDistance.current > 0 && (
        <span className="text-primary font-semibold ml-2">
          {totalDistance.current.toFixed(2)} km
        </span>
      )}
    </div>
  );
};
