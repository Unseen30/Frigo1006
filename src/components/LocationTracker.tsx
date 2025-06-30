import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Loader2, MapPin, MapPinOff } from "lucide-react";
import { 
  checkLocationPermissions, 
  checkLocationEnabled, 
  requestLocationPermissions 
} from "@/utils/locationPermissions";
import { saveRoutePoints, saveStreet } from "@/utils/routeCache";
import { reverseGeocode } from "@/services/geocoding";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Extender la interfaz PositionOptions para incluir distanceFilter
declare global {
  interface PositionOptions {
    distanceFilter?: number;
  }
}

type PermissionState = 'granted' | 'denied' | 'prompt';

interface Position {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

interface LocationTrackerProps {
  tripId: string;
  onDistanceUpdate?: (distance: number) => void;
}

const LocationTracker: React.FC<LocationTrackerProps> = ({ tripId, onDistanceUpdate = () => {} }) => {
  // Estados para el seguimiento y permisos
  const [tracking, setTracking] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  
  // Referencias para mantener valores entre renderizados
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<Position | null>(null);
  const totalDistance = useRef<number>(0);
  const isMounted = useRef(true);

  // Función para calcular la distancia entre dos puntos usando la fórmula de Haversine
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (lat1 === lat2 && lon1 === lon2) return 0;
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

  // Función para manejar actualizaciones de posición
  const handlePositionUpdate = useCallback(async (position: Position) => {
    const { latitude, longitude, accuracy, speed = null, heading = null } = position.coords;
    const timestamp = Date.now();
    
    // Filtrar lecturas con baja precisión (más de 30 metros de error)
    if (accuracy > 30) {
      console.log(`Posición descartada por baja precisión: ${accuracy}m`);
      return;
    }
    
    // Filtrar posiciones con velocidad inverosímil (más de 200 km/h)
    const currentSpeedKmh = speed ? (speed * 3.6) : 0;
    if (currentSpeedKmh > 200) {
      console.log(`Posición descartada por velocidad inverosímil: ${currentSpeedKmh.toFixed(1)} km/h`);
      return;
    }

    // Crear un nuevo punto de ruta con metadatos adicionales
    const newPoint = {
      latitude,
      longitude,
      timestamp: new Date(timestamp).toISOString(),
      accuracy,
      speed,
      heading,
      battery_level: null,
      altitude: position.coords.altitude,
      altitude_accuracy: position.coords.altitudeAccuracy
    };

    try {
      // Guardar en caché local
      await saveRoutePoints(tripId, [newPoint]);

      // Intentar geocodificación inversa para identificar la calle (solo ocasionalmente para reducir llamadas)
      if (Math.random() < 0.1) {
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address?.street) {
            await saveStreet(
              `${address.street}-${address.city || ''}`,
              address.street,
              [{ latitude, longitude }]
            );
          }
        } catch (geocodeError) {
          console.warn('No se pudo obtener la dirección:', geocodeError);
        }
      }

      // Calcular la distancia si hay una posición anterior
      if (lastPosition.current) {
        const distanceSegment = calculateHaversineDistance(
          lastPosition.current.coords.latitude,
          lastPosition.current.coords.longitude,
          latitude,
          longitude
        );
        
        // Solo agregar la distancia si el movimiento es significativo (más de 10 metros)
        // y la velocidad es razonable (menos de 150 km/h)
        const maxSpeedKmh = 150; // Aumentado ligeramente para cubrir más casos
        const minDistanceKm = 0.01; // 10 metros (aumentado de 5m)
        
        if (distanceSegment > minDistanceKm && currentSpeedKmh < maxSpeedKmh) {
          // Suavizar la distancia para evitar picos
          const smoothedDistance = distanceSegment * (1 - Math.min(0.9, currentSpeedKmh / 200));
          totalDistance.current += smoothedDistance;
          
          // Actualizar la distancia cada 50 metros o 15 segundos (más frecuente)
          const shouldUpdateDistance = 
            smoothedDistance > 0.05 || // 50 metros
            Date.now() - (lastPosition.current?.timestamp || 0) > 15000; // 15 segundos
          
          if (shouldUpdateDistance && onDistanceUpdate) {
            onDistanceUpdate(totalDistance.current);
            
            // Actualizar la distancia en la tabla de viajes
            await supabase
              .from('trips')
              .update({ 
                distance: totalDistance.current,
                updated_at: new Date().toISOString()
              })
              .eq('id', tripId);
          }
          
          console.log(`Distancia agregada: ${distanceSegment.toFixed(3)} km - Total: ${totalDistance.current.toFixed(2)} km`);
          
          // Guardar en la base de datos (solo puntos significativos)
          const { error } = await supabase
            .from('route_points')
            .insert({
              trip_id: tripId,
              latitude,
              longitude,
              accuracy,
              speed: speed || 0,
              heading: heading || null,
              timestamp: new Date().toISOString()
            });

          if (error) console.error('Error al guardar punto de ruta:', error);
        }
      } else {
        // Es el primer punto, actualizar la distancia inicial
        if (onDistanceUpdate) onDistanceUpdate(0);
      }

      // Actualizar la última posición
      lastPosition.current = {
        ...position,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error al guardar la ubicación:', error);
      toast.error('Error al actualizar la ubicación');
    }
  }, [tripId, onDistanceUpdate]);

  // Función para verificar el estado de la ubicación
  const verifyLocationStatus = useCallback(async (showError = true) => {
    try {
      if (isCheckingLocation) {
        return { hasPermission: false, isEnabled: false, error: 'Verificación en curso...' };
      }
      
      setIsCheckingLocation(true);
      setLocationError(null);
      
      if (!navigator.geolocation) {
        const errorMsg = 'La geolocalización no es compatible con tu navegador. Por favor, utiliza un navegador moderno.';
        if (showError) setLocationError(errorMsg);
        return { hasPermission: false, isEnabled: false, error: errorMsg };
      }

      const { granted: hasPermission, message: permissionMessage } = await checkLocationPermissions();
      
      if (!hasPermission) {
        const errorMsg = permissionMessage || 'Por favor, permite el acceso a tu ubicación para continuar';
        if (showError) {
          setLocationError(errorMsg);
          setShowPermissionDialog(true);
        }
        return { hasPermission: false, isEnabled: false, error: errorMsg };
      }

      const { enabled: isEnabled, message: enabledMessage } = await checkLocationEnabled();
      
      if (!isEnabled) {
        const errorMsg = enabledMessage || 'La ubicación parece estar desactivada. Actívala para continuar.';
        if (showError) {
          setLocationError(errorMsg);
          setShowPermissionDialog(true);
        }
        return { hasPermission: true, isEnabled: false, error: errorMsg };
      }

      return { hasPermission: true, isEnabled: true, error: null };
    } catch (error) {
      console.error('Error al verificar el estado de la ubicación:', error);
      const errorMsg = error instanceof Error ? error.message : 'No se pudo verificar el estado de la ubicación. Intenta recargar la página.';
      if (showError) setLocationError(errorMsg);
      return { hasPermission: false, isEnabled: false, error: errorMsg };
    } finally {
      setIsCheckingLocation(false);
    }
  }, [isCheckingLocation]);

  // Función para obtener la posición actual
  const getInitialPosition = (options: PositionOptions) => {
    return new Promise<Position>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position as Position),
        reject,
        options
      );
    });
  };

  // Función para detener el seguimiento
  const stopLocationTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
      return true;
    }
    return false;
  }, []);

  // Función para iniciar el seguimiento
  const startTracking = useCallback(async () => {
    try {
      // Configurar opciones de geolocalización optimizadas
      const options: PositionOptions & { distanceFilter?: number } = {
        enableHighAccuracy: true, // Usar GPS si está disponible
        timeout: 10000, // Reducido de 15s a 10s para mejor respuesta
        maximumAge: 10000, // Aceptar lecturas de hasta 10 segundos de antigüedad
        distanceFilter: 10 // Aumentado de 5m a 10m para mejor rendimiento
      };
      
      // Ajustar configuración según el estado de la batería
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          if (battery) {
            // Si la batería está por debajo del 20%, reducir la precisión
            if (battery.level < 0.2) {
              options.enableHighAccuracy = false;
              options.distanceFilter = 20; // Aumentar distancia mínima
              console.log('Modo bajo consumo activado (batería < 20%)');
            }
            
            // Escuchar cambios en el estado de la batería
            battery.addEventListener('levelchange', () => {
              if (battery.level < 0.2) {
                if (watchId.current !== null) {
                  navigator.geolocation.clearWatch(watchId.current);
                  options.enableHighAccuracy = false;
                  options.distanceFilter = 20;
                  watchId.current = navigator.geolocation.watchPosition(
                    handlePositionUpdate as PositionCallback,
                    (error) => console.error('Error en geolocalización:', error),
                    options
                  );
                }
              }
            });
          }
        } catch (error) {
          console.warn('No se pudo acceder a la información de la batería:', error);
        }
      }

      // Obtener posición inicial
      const initialPosition = await getInitialPosition(options);
      await handlePositionUpdate(initialPosition);
      
      const { granted } = await requestLocationPermissions();
      
      if (granted) {
        setPermissionStatus('granted');
        setShowPermissionDialog(false);
        
        // Iniciar el seguimiento de ubicación
        setTracking(true);
        setLocationError(null);
        
        // Configurar el watchPosition
        watchId.current = navigator.geolocation.watchPosition(
          handlePositionUpdate as PositionCallback,
          (error) => {
            console.error('Error en geolocalización:', error);
            setLocationError('Error al obtener la ubicación. Verifica la configuración de ubicación.');
            stopLocationTracking();
          },
          options
        );
        
        toast.success('Seguimiento de ubicación activado');
      } else {
        setPermissionStatus('denied');
        setLocationError('Se requieren permisos de ubicación para continuar');
        setShowPermissionDialog(true);
      }
    } catch (error) {
      console.error('Error al iniciar el seguimiento:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al iniciar el seguimiento';
      setLocationError(errorMsg);
      setShowPermissionDialog(true);
    }
  }, [handlePositionUpdate, stopLocationTracking]);

  // Función para manejar la habilitación de la ubicación
  const handleEnableLocation = useCallback(async () => {
    if (isRequestingPermission) return;
    
    setIsRequestingPermission(true);
    setLocationError(null);
    
    try {
      const { hasPermission, isEnabled, error } = await verifyLocationStatus(true);
      
      if (hasPermission && isEnabled) {
        await startTracking();
        setShowPermissionDialog(false);
      } else if (error) {
        setLocationError(error);
      }
    } catch (error) {
      console.error('Error al habilitar la ubicación:', error);
      setLocationError('No se pudo habilitar la ubicación. Verifica la configuración de tu dispositivo.');
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission, verifyLocationStatus, startTracking]);

  // Efecto para verificar permisos al montar
  useEffect(() => {
    const checkPermissions = async () => {
      if (!isMounted.current) return;
      
      try {
        console.log('🔍 Verificando permisos de ubicación...');
        const { hasPermission, isEnabled, error } = await verifyLocationStatus();
        
        console.log('✅ Resultado de verificación de permisos:', { hasPermission, isEnabled, error });
        
        if (hasPermission && isEnabled) {
          console.log('🚀 Permisos y ubicación activados, iniciando seguimiento...');
          await startTracking();
          console.log('📍 Seguimiento de ubicación iniciado correctamente');
        } else if (error) {
          console.warn('⚠️ Error en la verificación de permisos:', error);
          if (isMounted.current) {
            setLocationError(error);
            setShowPermissionDialog(!hasPermission || !isEnabled);
          }
        }
      } catch (error) {
        console.error('❌ Error en checkPermissions:', error);
        if (isMounted.current) {
          const errorMsg = error instanceof Error ? error.message : 'Error al verificar los permisos de ubicación';
          setLocationError(errorMsg);
          setShowPermissionDialog(true);
        }
      }
    };

    if (tripId) {
      checkPermissions();
    }
    
    // Limpieza al desmontar
    return () => {
      isMounted.current = false;
      stopLocationTracking();
    };
  }, [tripId, verifyLocationStatus, stopLocationTracking, startTracking]);

  return (
    <div className="space-y-4">
      {locationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de ubicación</AlertTitle>
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <Button
            variant={tracking ? 'destructive' : 'default'}
            onClick={tracking ? stopLocationTracking : startTracking}
            disabled={isRequestingPermission || isCheckingLocation}
            className="min-w-[180px] justify-start"
          >
            {isCheckingLocation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : tracking ? (
              <>
                <MapPinOff className="mr-2 h-4 w-4" />
                Detener seguimiento
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Iniciar seguimiento
              </>
            )}
          </Button>
          
          {tracking && (
            <div className="flex items-center text-sm text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              En progreso
            </div>
          )}
        </div>
        
        {totalDistance.current > 0 && (
          <div className="text-sm text-muted-foreground">
            Distancia recorrida: <span className="font-medium">{totalDistance.current.toFixed(2)} km</span>
          </div>
        )}
      </div>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permiso de ubicación requerido</DialogTitle>
            <DialogDescription>
              {locationError || 'Necesitamos acceso a tu ubicación para realizar el seguimiento de la ruta.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPermissionDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleEnableLocation}
              disabled={isRequestingPermission}
            >
              {isRequestingPermission ? 'Solicitando...' : 'Activar ubicación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationTracker;
