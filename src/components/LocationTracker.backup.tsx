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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

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

export const LocationTracker: React.FC<LocationTrackerProps> = ({ tripId, onDistanceUpdate = () => {} }) => {
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

  // Fórmula de Haversine para calcular distancia entre dos puntos GPS
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

  const handlePositionUpdate = async (position: Position) => {
    const { latitude, longitude, accuracy, speed = null, heading = null } = position.coords;
    const timestamp = Date.now();
    
    // Filtrar lecturas con baja precisión (más de 50 metros de error)
    if (accuracy > 50) {
      console.log(`Posición descartada por baja precisión: ${accuracy}m`);
      return;
    }

    // Crear un nuevo punto de ruta con metadatos adicionales
    const newPoint = {
      latitude,
      longitude,
      timestamp: new Date(timestamp).toISOString(),
      accuracy,
      speed: speed,
      heading: heading,
      battery_level: null, // Se puede obtener de la API de Battery Status si está disponible
      altitude: position.coords.altitude,
      altitude_accuracy: position.coords.altitudeAccuracy
    };

    try {
      // Guardar en caché local
      await saveRoutePoints(tripId, [newPoint]);

      // Intentar geocodificación inversa para identificar la calle (solo ocasionalmente para reducir llamadas)
      if (Math.random() < 0.1) { // 10% de probabilidad de hacer geocodificación
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
        
        // Solo agregar la distancia si el movimiento es significativo (más de 5 metros)
        // y la velocidad es razonable (menos de 120 km/h para filtrar errores)
        const maxSpeedKmh = 120;
        const currentSpeedKmh = speed ? (speed * 3.6) : 0;
        
        if (distanceSegment > 0.005 && currentSpeedKmh < maxSpeedKmh) {
          totalDistance.current += distanceSegment;
          
          // Actualizar la distancia cada 100 metros o 30 segundos
          const shouldUpdateDistance = 
            distanceSegment > 0.1 || 
            Date.now() - (lastPosition.current?.timestamp || 0) > 30000;
          
          if (shouldUpdateDistance) {
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
        onDistanceUpdate(0);
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
  };

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

  // Función para detener el seguimiento
  const stopLocationTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;

    if (!hasPermission) {
      const errorMsg = permissionMessage || 'Por favor, permite el acceso a tu ubicación para continuar';
      if (showError) {
        setLocationError(errorMsg);
        setShowPermissionDialog(true);
      }
      return { hasPermission: false, isEnabled: false, error: errorMsg };
    }

    setTracking(true);
    setLocationError(null);

  try {
    // Configurar opciones de geolocalización para máxima precisión
    const options = {
      enableHighAccuracy: true, // Usar GPS si está disponible
      timeout: 15000, // Tiempo máximo para obtener una lectura
      maximumAge: 0, // No usar lecturas en caché
      distanceFilter: 5 // Mínimo desplazamiento en metros para recibir actualizaciones
    };

    // Obtener posición actual primero
    const getInitialPosition = () => {
      return new Promise<Position>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position as Position),
          reject,
          options
        );
      });
    };

    // Obtener posición inicial
    try {
      const initialPosition = await getInitialPosition();
      await handlePositionUpdate(initialPosition);
      const { granted, message } = await requestLocationPermissions();
      
      if (granted) {
        setPermissionStatus('granted');
        setShowPermissionDialog(false);
        
        // Verificar el estado después de conceder permisos
        const { isEnabled, error: statusError } = await verifyLocationStatus(false);
        
        if (isEnabled) {
          // Iniciar el seguimiento de ubicación
          await startTracking();
          toast.success('Seguimiento de ubicación activado');
        } else {
          const errorMsg = statusError || 'Activa la ubicación en la configuración de tu dispositivo';
          setLocationError(errorMsg);
          setShowPermissionDialog(true);
        }
      } else {
        setPermissionStatus('denied');
        const errorMsg = message || 'Se requieren permisos de ubicación para continuar';
        setLocationError(errorMsg);
        setShowPermissionDialog(true);
      }
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error al solicitar permisos de ubicación';
      setLocationError(errorMsg);
      setShowPermissionDialog(true);
    } finally {
      setIsRequestingPermission(false);
    }
  }, [verifyLocationStatus, startTracking]);

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
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [tripId, verifyLocationStatus, startLocationTracking]);

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
            onClick={tracking ? stopLocationTracking : startLocationTracking}
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
