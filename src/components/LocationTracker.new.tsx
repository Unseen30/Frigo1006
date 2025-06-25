import React, { useEffect, useRef, useState, useCallback, FC } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, MapPin, MapPinOff, Compass } from "lucide-react";
import { 
  checkLocationPermissions, 
  checkLocationEnabled, 
  requestLocationPermissions 
} from "@/utils/locationPermissions";
import { 
  startBackgroundTracking, 
  stopBackgroundTracking 
} from "@/utils/backgroundLocation";
import { saveRoutePoints } from "@/utils/routeCache";
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

export const LocationTracker: React.FC<LocationTrackerProps> = ({ 
  tripId, 
  onDistanceUpdate = () => {} 
}) => {
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
  const calculateHaversineDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en kilómetros
  }, []);

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
        setIsCheckingLocation(false);
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
  }, [isCheckingLocation, setLocationError, setShowPermissionDialog]);

  // Función para manejar la actualización de posición
  const handlePositionUpdate = useCallback(async (position: Position) => {
    if (!isMounted.current) return;

    const { latitude, longitude, accuracy } = position.coords;
    
    // Actualizar la última posición
    lastPosition.current = position;

    try {
      // Guardar punto de ruta
      await saveRoutePoints(tripId, [{
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
        accuracy
      }]);

      // Actualizar la ubicación en la base de datos
      const { error } = await supabase
        .from('trips')
        .update({ 
          current_location_coords: `POINT(${longitude} ${latitude})`,
          location_accuracy: accuracy,
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) throw error;

      // Calcular distancia si hay una posición anterior
      if (lastPosition.current?.coords) {
        const distance = calculateHaversineDistance(
          lastPosition.current.coords.latitude,
          lastPosition.current.coords.longitude,
          latitude,
          longitude
        );
        
        if (distance > 0) {
          totalDistance.current += distance;
          onDistanceUpdate(totalDistance.current);
        }
      }
    } catch (error) {
      console.error('Error al actualizar la ubicación:', error);
    }
  }, [tripId, onDistanceUpdate, calculateHaversineDistance]);

  // Función para detener el seguimiento de ubicación
  const stopLocationTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
    stopBackgroundTracking();
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
      
      // Detener cualquier seguimiento anterior
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      if (!navigator.geolocation) {
        setLocationError('La geolocalización no está disponible en este dispositivo');
        setTracking(false);
        return;
      }

      // Obtener la posición actual
      const position = await new Promise<Position>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos as unknown as Position),
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      // Iniciar seguimiento de posición
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => handlePositionUpdate(pos as unknown as Position),
        (error) => {
          console.error('Error de geolocalización:', error);
          setLocationError('Error al obtener la ubicación. Verifica los permisos.');
          stopLocationTracking();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );

      // Iniciar seguimiento en segundo plano
      await startBackgroundTracking(tripId);
      
      // Actualizar la posición inicial
      await handlePositionUpdate(position);
      
    } catch (error) {
      console.error('Error al iniciar el seguimiento de ubicación:', error);
      setLocationError('No se pudo iniciar el seguimiento de ubicación');
      stopLocationTracking();
    }
  }, [tripId, tracking, isCheckingLocation, verifyLocationStatus, handlePositionUpdate, stopLocationTracking]);

  // Manejar la habilitación de la ubicación
  const handleEnableLocation = useCallback(async () => {
    try {
      setIsRequestingPermission(true);
      setLocationError(null);
      
      const { granted, message } = await requestLocationPermissions();
      
      if (granted) {
        setPermissionStatus('granted');
        setShowPermissionDialog(false);
        await startLocationTracking();
      } else {
        setPermissionStatus('denied');
        setLocationError(message || 'No se pudo obtener el permiso de ubicación');
      }
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
      setLocationError('Error al solicitar permisos de ubicación');
    } finally {
      setIsRequestingPermission(false);
    }
  }, [startLocationTracking]);

  // Efecto para limpieza al desmontar
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      stopBackgroundTracking();
    };
  }, []);

  // Verificar permisos al montar
  useEffect(() => {
    const checkPermissions = async () => {
      const { hasPermission } = await verifyLocationStatus(false);
      setPermissionStatus(hasPermission ? 'granted' : 'denied');
    };
    
    checkPermissions();
  }, [verifyLocationStatus]);

  // Iniciar/Detener seguimiento cuando cambia el estado de seguimiento
  useEffect(() => {
    if (tracking) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    
    return () => {
      stopLocationTracking();
    };
  }, [tracking, startLocationTracking, stopLocationTracking]);

  return (
    <div className="space-y-4">
      {permissionStatus !== 'granted' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permisos de ubicación requeridos</AlertTitle>
          <AlertDescription>
            {locationError || 'Necesitamos acceso a tu ubicación para realizar el seguimiento de la ruta.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center space-x-4">
        <Button
          variant={tracking ? 'destructive' : 'default'}
          onClick={() => setTracking(!tracking)}
          disabled={isCheckingLocation || isRequestingPermission}
        >
          {isCheckingLocation ? (
            <>
              <Compass className="mr-2 h-4 w-4 animate-spin" />
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
              disabled={isRequestingPermission}
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
