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
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date().toISOString();
    
    // Filtrar lecturas con baja precisión (más de 50 metros de error)
    if (accuracy > 50) {
      console.log(`Posición descartada por baja precisión: ${accuracy}m`);
      return;
    }

    try {
      // Guardar en caché local
      await saveRoutePoints(tripId, [{
        latitude,
        longitude,
        timestamp,
        accuracy
      }]);

      // Intentar geocodificación inversa para identificar la calle
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

      // Guardar en la base de datos
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
      if (lastPosition.current) {
        const distanceSegment = calculateHaversineDistance(
          lastPosition.current.coords.latitude,
          lastPosition.current.coords.longitude,
          latitude,
          longitude
        );
        
        // Solo agregar la distancia si el movimiento es significativo (más de 10 metros)
        if (distanceSegment > 0.01) {
          totalDistance.current += distanceSegment;
          onDistanceUpdate(totalDistance.current);

          // Actualizar la distancia en la tabla de viajes
          await supabase
            .from('trips')
            .update({ distance: totalDistance.current })
            .eq('id', tripId);

          console.log(`Distancia agregada: ${distanceSegment.toFixed(3)} km - Total: ${totalDistance.current.toFixed(2)} km`);
        }
      }

      lastPosition.current = position;
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
    }
    setTracking(false);
    toast.info('Seguimiento de ubicación detenido');
  }, []);

  // Función para iniciar el seguimiento de ubicación
  const startLocationTracking = useCallback(async () => {
    if (!tripId) return;
    
    try {
      if (isCheckingLocation || tracking) return;
      
      setLocationError(null);
      setTracking(true);
      
      const isReady = await verifyLocationStatus();
      if (!isReady.hasPermission || !isReady.isEnabled) {
        setTracking(false);
        return;
      }
      
      // Limpiar cualquier seguimiento previo
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      const onPositionSuccess = (position: Position) => {
        if (!isMounted.current) return;
        setLocationError(null);
        handlePositionUpdate(position);
      };

      const onPositionError = (error: GeolocationPositionError) => {
        if (!isMounted.current) return;
        
        console.error('Error de geolocalización:', error);
        let errorMessage = 'Error al obtener la ubicación';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo y actualiza la página.';
            setPermissionStatus('denied');
            setShowPermissionDialog(true);
            setTracking(false);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'La información de ubicación no está disponible. Asegúrate de tener conexión a Internet y el GPS activado.';
            setTracking(false);
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado al intentar obtener la ubicación. Verifica tu conexión a Internet.';
            setTracking(false);
            break;
        }
        
        setLocationError(errorMessage);
        toast.error(errorMessage);
      };

      // Obtener la posición actual primero
      const position = await new Promise<Position>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos as unknown as Position),
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      // Si llegamos aquí, la ubicación está disponible
      onPositionSuccess(position);
      
      // Iniciar el seguimiento continuo
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => onPositionSuccess(pos as unknown as Position),
        onPositionError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );

      setTracking(true);
      toast.success('Seguimiento de ubicación iniciado');
    } catch (error) {
      console.error('Error al iniciar el seguimiento de ubicación:', error);
      setLocationError('No se pudo acceder a la ubicación. Verifica los permisos y la configuración.');
      setShowPermissionDialog(true);
      setTracking(false);
    }
  }, [tripId, isCheckingLocation, tracking, verifyLocationStatus]);

  // Manejar la activación de la ubicación desde el diálogo
  const handleEnableLocation = useCallback(async () => {
    try {
      setIsRequestingPermission(true);
      setLocationError(null);
      
      // Solicitar permisos
      const { granted, message } = await requestLocationPermissions();
      
      if (granted) {
        setPermissionStatus('granted');
        setShowPermissionDialog(false);
        
        // Verificar el estado después de conceder permisos
        const { isEnabled, error: statusError } = await verifyLocationStatus(false);
        
        if (isEnabled) {
          // Iniciar el seguimiento de ubicación
          await startLocationTracking();
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
  }, [startLocationTracking, verifyLocationStatus]);

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
          await startLocationTracking();
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
