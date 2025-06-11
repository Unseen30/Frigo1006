import { supabase } from '@/integrations/supabase/client';

// Extender el tipo ServiceWorkerRegistration para incluir la propiedad sync
declare global {
  interface ServiceWorkerRegistration {
    sync: {
      register(tag: string): Promise<void>;
      getTags(): Promise<string[]>;
    };
  }
}

let watchId: number | null = null;
let lastPosition: GeolocationPosition | null = null;
let totalDistance = 0;
let isTracking = false;

// Función para calcular la distancia entre dos puntos GPS
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

export const startBackgroundTracking = (tripId: string) => {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.warn('Service Worker o Background Sync no están soportados en este navegador');
    return false;
  }

  if (isTracking) {
    console.log('El seguimiento en segundo plano ya está activo');
    return true;
  }

  isTracking = true;
  
  // Registrar el Service Worker
  navigator.serviceWorker.ready.then(registration => {
    // Registrar el sync para sincronización en segundo plano
    return registration.sync.register('track-location');
  }).then(() => {
    console.log('Seguimiento en segundo plano registrado');
  }).catch(err => {
    console.error('Error al registrar el seguimiento en segundo plano:', err);
    isTracking = false;
  });

  // Iniciar el seguimiento de ubicación
  watchId = navigator.geolocation.watchPosition(
    (position) => handlePositionUpdate(position, tripId),
    (error) => {
      console.error('Error en seguimiento de ubicación:', error);
      isTracking = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );

  return true;
};

export const stopBackgroundTracking = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastPosition = null;
  totalDistance = 0;
  isTracking = false;
};

const handlePositionUpdate = async (position: GeolocationPosition, tripId: string) => {
  const { latitude, longitude, accuracy } = position.coords;
  
  // Filtrar lecturas con baja precisión
  if (accuracy > 50) {
    console.log('Posición descartada por baja precisión:', accuracy, 'metros');
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

    // Calcular la distancia si hay una posición anterior
    if (lastPosition) {
      const distance = calculateHaversineDistance(
        lastPosition.coords.latitude,
        lastPosition.coords.longitude,
        latitude,
        longitude
      );
      
      // Solo agregar la distancia si el movimiento es significativo (más de 10 metros)
      if (distance > 0.01) {
        totalDistance += distance;
        
        // Actualizar la distancia en la tabla de viajes
        const { error: updateError } = await supabase
          .from('trips')
          .update({ distance: totalDistance })
          .eq('id', tripId);

        if (updateError) throw updateError;
      }
    }

    lastPosition = position;
  } catch (error) {
    console.error('Error al guardar la ubicación en segundo plano:', error);
  }
};
