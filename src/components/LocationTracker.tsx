
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, MapPin, MapPinOff, Compass } from "lucide-react";
import { checkLocationPermissions, checkLocationEnabled, requestLocationPermissions } from "@/utils/locationPermissions";
import { startBackgroundTracking, stopBackgroundTracking } from "@/utils/backgroundLocation";
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

interface LocationTrackerProps {
  tripId: string;
  onDistanceUpdate?: (distance: number) => void;
}

export const LocationTracker = ({ tripId, onDistanceUpdate }: LocationTrackerProps) => {
  const [tracking, setTracking] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const totalDistance = useRef<number>(0);
  const permissionChecked = useRef(false);

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

  const verifyLocationStatus = useCallback(async () => {
    try {
      setIsCheckingLocation(true);
      setLocationError(null);
      
      // Verificar si el navegador soporta geolocalización
      if (!navigator.geolocation) {
        setLocationError('La geolocalización no es compatible con tu navegador');
        return false;
      }

      // Verificar permisos de ubicación
      const hasPermission = await checkLocationPermissions();
      if (!hasPermission) {
        setLocationError('Por favor, permite el acceso a tu ubicación para continuar');
        setShowPermissionDialog(true);
        return false;
      }

      // Verificar si la ubicación está activada
      const isEnabled = await checkLocationEnabled();
      if (!isEnabled) {
        setLocationError('La ubicación parece estar desactivada. Actívala para continuar.');
        setShowPermissionDialog(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error al verificar el estado de la ubicación:', error);
      setLocationError('No se pudo verificar el estado de la ubicación. Intenta recargar la página.');
      return false;
    } finally {
      setIsCheckingLocation(false);
    }
  }, []);

  const startLocationTracking = useCallback(async () => {
    if (!tripId) return;
    
    try {
      const isReady = await verifyLocationStatus();
      if (!isReady) return;

      if (!navigator.geolocation) {
        setLocationError('La geolocalización no está disponible en este dispositivo');
        return;
      }

      setLocationError(null);

      const onPositionSuccess = (position: GeolocationPosition) => {
        setLocationError(null);
        handlePositionUpdate(position);
      };

      const onPositionError = (error: GeolocationPositionError) => {
        console.error('Error de geolocalización:', error);
        let errorMessage = 'Error al obtener la ubicación';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo.';
            setShowPermissionDialog(true);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'La información de ubicación no está disponible. Asegúrate de tener conexión a Internet y el GPS activado.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado al intentar obtener la ubicación.';
            break;
        }
        
        setLocationError(errorMessage);
        toast.error(errorMessage);
      };

      // Obtener la posición actual primero
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      // Si llegamos aquí, la ubicación está disponible
      onPositionSuccess(position);
      
      // Iniciar el seguimiento continuo
      watchId.current = navigator.geolocation.watchPosition(
        onPositionSuccess,
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
    }
  }, [tripId, verifyLocationStatus]);

  const handleEnableLocation = useCallback(async () => {
    try {
      const granted = await requestLocationPermissions();
      if (granted) {
        setPermissionStatus('granted');
        setShowPermissionDialog(false);
        
        // Esperar un momento para que se cierre el diálogo
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Iniciar el seguimiento de ubicación
        await startLocationTracking();
        
        // Verificar si el seguimiento se inició correctamente
        if (tracking) {
          toast.success('Seguimiento de ubicación activado');
        } else {
          setPermissionStatus('denied');
          setLocationError('No se pudo iniciar el seguimiento de ubicación');
        }
      } else {
        setPermissionStatus('denied');
        setLocationError('Se requieren permisos de ubicación para continuar');
        setShowPermissionDialog(true);
      }
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
      setLocationError('Error al solicitar permisos de ubicación');
      setShowPermissionDialog(true);
    }
  }, [startLocationTracking, tracking]);

  // Verificar permisos al cargar el componente
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const hasPermission = await checkLocationPermissions();
        setPermissionStatus(hasPermission ? 'granted' : 'denied');
        
        if (hasPermission) {
          const isEnabled = await checkLocationEnabled();
          if (isEnabled) {
            // Iniciar el seguimiento si los permisos están habilitados
            startLocationTracking().catch(error => {
              console.error('Error al iniciar el seguimiento:', error);
              setLocationError('Error al iniciar el seguimiento de ubicación');
            });
          } else {
            setLocationError('La ubicación está desactivada en tu dispositivo. Actívala para continuar.');
            setShowPermissionDialog(true);
          }
        } else {
          setShowPermissionDialog(true);
        }
      } catch (error) {
        console.error('Error al verificar permisos:', error);
        setLocationError('Error al verificar los permisos de ubicación');
        setShowPermissionDialog(true);
      }
    };

    checkPermissions();
  }, []);

  // Manejar el estado de la aplicación (primer plano/segundo plano)
  useEffect(() => {
    if (!tripId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // La aplicación está en primer plano
        stopBackgroundTracking();
        startLocationTracking();
      } else {
        // La aplicación está en segundo plano o en otra pestaña
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        startBackgroundTracking(tripId);
      }
    };

    // Registrar el event listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Iniciar el seguimiento cuando el componente se monta
    if (!permissionChecked.current) {
      startLocationTracking();
      permissionChecked.current = true;
    }

    // Limpiar al desmontar
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      
      stopBackgroundTracking();
      setTracking(false);
    };
  }, [tripId, startLocationTracking]);

  return (
    <div className="space-y-4">
      {permissionStatus !== 'granted' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permisos de ubicación requeridos</AlertTitle>
          <AlertDescription>
            Necesitamos acceso a tu ubicación para realizar el seguimiento del viaje.
          </AlertDescription>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={handleEnableLocation}
            disabled={isCheckingLocation}
          >
            <Compass className="mr-2 h-4 w-4" />
            {isCheckingLocation ? 'Verificando...' : 'Activar ubicación'}
          </Button>
        </Alert>
      )}

      {locationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de ubicación</AlertTitle>
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {tracking ? (
            <>
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
              <span>Seguimiento activo</span>
            </>
          ) : (
            <span>Seguimiento inactivo</span>
          )}
        </div>
        <Button
          variant={tracking ? "destructive" : "default"}
          onClick={tracking ? stopBackgroundTracking : startLocationTracking}
          disabled={isCheckingLocation || permissionStatus !== 'granted'}
        >
          {isCheckingLocation ? (
            "Cargando..."
          ) : tracking ? (
            "Detener seguimiento"
          ) : (
            "Iniciar seguimiento"
          )}
        </Button>
      </div>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <MapPin className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-lg">
              Permiso de ubicación requerido
            </DialogTitle>
            <DialogDescription className="text-center">
              Para continuar, necesitamos acceder a tu ubicación. Por favor, activa los permisos de ubicación en la configuración de tu dispositivo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-50 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Activa la ubicación</h4>
                <p className="text-sm text-gray-500">
                  Asegúrate de que la ubicación esté activada en la configuración de tu dispositivo.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-green-50 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Selecciona "Permitir siempre"</h4>
                <p className="text-sm text-gray-500">
                  Para un mejor seguimiento, permite el acceso a la ubicación en todo momento.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="sm:flex sm:flex-row-reverse gap-2">
            <Button 
              onClick={handleEnableLocation}
              className="w-full sm:w-auto"
              disabled={isCheckingLocation}
            >
              {isCheckingLocation ? 'Verificando...' : 'Activar ubicación'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowPermissionDialog(false)}
              className="w-full sm:w-auto"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
