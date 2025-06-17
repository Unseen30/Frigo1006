import { supabase } from '@/integrations/supabase/client';
import { saveRoutePoints, getRoutePoints, initDB as initRouteCache } from './routeCache';
import { reverseGeocode } from '@/services/geocoding'; 

// Tiempo en milisegundos entre sincronizaciones con el servidor (5 minutos)
const SYNC_INTERVAL = 5 * 60 * 1000; 

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
let lastSyncTime = 0; // Tiempo de la última sincronización con el servidor

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

export const startBackgroundTracking = async (tripId: string) => {
  // Inicializar caché
  await initRouteCache();
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

// Sincronizar puntos en caché con el servidor
export const syncCachedPoints = async (tripId: string) => {
  try {
    const points = await getRoutePoints(tripId);
    if (points.length === 0) return;
    
    console.log(`[Background] Sincronizando ${points.length} puntos con el servidor...`);
    
    // Insertar puntos en lote
    const { error } = await supabase
      .from('route_points')
      .insert(points.map(p => ({
        trip_id: tripId,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp
      })));
    
    if (error) throw error;
    
    console.log(`[Background] ${points.length} puntos sincronizados correctamente`);
    lastSyncTime = Date.now();
    return points.length;
  } catch (error) {
    console.error('[Background] Error al sincronizar puntos:', error);
    throw error;
  }
};

export const handlePositionUpdate = async (position: GeolocationPosition, tripId: string) => {
  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = new Date().toISOString();
  
  // Filtrar lecturas con baja precisión (más de 50 metros de error)
  if (accuracy > 50) {
    console.log(`[Background] Posición descartada por baja precisión: ${accuracy}m`);
    return;
  }
  
  // Guardar en caché local
  try {
    await saveRoutePoints(tripId, [{
      latitude,
      longitude,
      timestamp,
      accuracy
    }]);
    
    // Sincronizar con el servidor periódicamente
    const now = Date.now();
    if (now - lastSyncTime > SYNC_INTERVAL) {
      await syncCachedPoints(tripId);
    }
    
    // Intentar geocodificación inversa para identificar la calle
    try {
      const address = await reverseGeocode(latitude, longitude);
      if (address?.street) {
        // Aquí podrías guardar la calle en caché si es necesario
        console.log(`[Background] Calle detectada: ${address.street}`);
      }
    } catch (geocodeError) {
      console.warn('[Background] No se pudo obtener la dirección:', geocodeError);
    }
  } catch (cacheError) {
    console.error('[Background] Error al guardar en caché:', cacheError);
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
