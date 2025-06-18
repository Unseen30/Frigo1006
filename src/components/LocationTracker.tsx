
import React, { useEffect, useRef, useState, useCallback } from "react";
import type { JSX } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, MapPin, MapPinOff, Compass } from "lucide-react";
import { checkLocationPermissions, checkLocationEnabled, requestLocationPermissions } from "@/utils/locationPermissions";
import { startBackgroundTracking, stopBackgroundTracking } from "@/utils/backgroundLocation";
import { saveRoutePoints, getRoutePoints, initDB as initRouteCache, saveStreet } from "@/utils/routeCache";
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

interface LocationTrackerProps {
  tripId: string;
  onDistanceUpdate?: (distance: number) => void;
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({ tripId, onDistanceUpdate }) => {
  // Estados para el seguimiento y permisos
  const [tracking, setTracking] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  
  // Referencias para mantener valores entre renderizados
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const totalDistance = useRef<number>(0);
  const permissionChecked = useRef(false);
  const isMounted = useRef(true); // Para evitar actualizaciones después de desmontar

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
    const timestamp = new Date().toISOString();
    
    // Filtrar lecturas con baja precisión (más de 50 metros de error)
    if (accuracy > 50) {
      console.log(`Posición descartada por baja precisión: ${accuracy}m`);
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
    } catch (cacheError) {
      console.error('Error al guardar en caché:', cacheError);
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

  const verifyLocationStatus = useCallback(async (showError = true) => {
    try {
      // Si ya estamos verificando, no hacer nada
      if (isCheckingLocation) {
        return { hasPermission: false, isEnabled: false, error: 'Verificación en curso...' };
      }
      
      setIsCheckingLocation(true);
      setLocationError(null);
      
      // Verificar si el navegador soporta geolocalización
      if (!navigator.geolocation) {
        const errorMsg = 'La geolocalización no es compatible con tu navegador. Por favor, utiliza un navegador moderno.';
        if (showError) setLocationError(errorMsg);
        setIsCheckingLocation(false);
        return { hasPermission: false, isEnabled: false, error: errorMsg };
      }

      // Verificar permisos de ubicación
      const { granted: hasPermission, message: permissionMessage } = await checkLocationPermissions();
      
      if (!hasPermission) {
        const errorMsg = permissionMessage || 'Por favor, permite el acceso a tu ubicación para continuar';
        if (showError) {
          setLocationError(errorMsg);
          setShowPermissionDialog(true);
        }
        return { hasPermission: false, isEnabled: false, error: errorMsg };
      }

      // Verificar si la ubicación está activada
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
  }, []);

  const startLocationTracking = useCallback(async () => {
    if (!tripId) return;
    
    try {
      // Si ya está en proceso de iniciar, no hacer nada
      if (isCheckingLocation || tracking) return;
      
      setLocationError(null); // Limpiar errores previos
      setTracking(true); // Establecer tracking a true inmediatamente para evitar múltiples llamadas
      
      const isReady = await verifyLocationStatus();
      if (!isReady.hasPermission || !isReady.isEnabled) {
        setTracking(false);
        return;
      }
      
      // Si ya hay un watchId activo, limpiarlo primero
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      }

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
            errorMessage = 'Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo y actualiza la página.';
            setPermissionStatus('denied');
            setShowPermissionDialog(true);
            setTracking(false); // Asegurarse de que el seguimiento se detenga
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'La información de ubicación no está disponible. Asegúrate de tener conexión a Internet y el GPS activado.';
            setTracking(false); // Asegurarse de que el seguimiento se detenga
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado al intentar obtener la ubicación. Verifica tu conexión a Internet.';
            setTracking(false); // Asegurarse de que el seguimiento se detenga
            break;
        }
        
        // Si el error es de permisos, forzar una verificación de estado
        if (error.code === error.PERMISSION_DENIED) {
          verifyLocationStatus().then(({ hasPermission, isEnabled }) => {
            console.log('Estado de permisos después del error:', { hasPermission, isEnabled });
            if (hasPermission && isEnabled) {
              // Si los permisos están bien, intentar reiniciar el seguimiento
              startLocationTracking();
            }
          });
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

  // Verificar permisos al cargar el componente
  useEffect(() => {
    // Función para verificar permisos
    const checkPermissions = async () => {
      if (!isMounted.current) return;
      
      try {
        console.log('🔍 Verificando permisos de ubicación...');
        const { hasPermission, isEnabled, error } = await verifyLocationStatus();
        
        console.log('✅ Resultado de verificación de permisos:', { hasPermission, isEnabled, error });
        
        if (hasPermission && isEnabled) {
          console.log('🚀 Permisos y ubicación activados, iniciando seguimiento...');
          // Iniciar el seguimiento si los permisos están habilitados
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

    // Verificar si ya se verificaron los permisos
    if (!permissionChecked.current) {
      checkPermissions();
      permissionChecked.current = true;
    }
    
    // Limpieza al desmontar
    return () => {
      isMounted.current = false;
    };
  }, [verifyLocationStatus, startLocationTracking]);

  // Manejar el estado de la aplicación (primer plano/segundo plano)
  useEffect(() => {
    if (!tripId || !isMounted.current) return;

    const handleVisibilityChange = async () => {
      if (!isMounted.current) return;
      
      if (document.visibilityState === 'visible') {
        // La aplicación está en primer plano
        console.log('Aplicación en primer plano');
        stopBackgroundTracking();
        
        // Si ya estamos rastreando, no hacer nada
        if (tracking) return;
        
        // Verificar permisos antes de iniciar el seguimiento
        try {
          const { hasPermission, isEnabled } = await verifyLocationStatus(false);
          if (hasPermission && isEnabled) {
            await startLocationTracking();
          }
        } catch (error) {
          console.error('Error al verificar permisos al volver a primer plano:', error);
        }
      } else {
        // La aplicación está en segundo plano o en otra pestaña
        console.log('Aplicación en segundo plano');
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        
        // Iniciar seguimiento en segundo plano solo si estábamos rastreando
        if (tracking) {
          startBackgroundTracking(tripId);
        }
      }
    };

    // Registrar el event listener para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Verificación inicial de visibilidad
    handleVisibilityChange();

    // Inicializar la caché de rutas al montar
    const init = async () => {
      if (!isMounted.current) return;
      
      try {
        await initRouteCache();
        // Cargar puntos de ruta guardados si existen
        const savedPoints = await getRoutePoints(tripId);
        if (savedPoints.length > 0) {
          // Actualizar la distancia total basada en los puntos guardados
          let distance = 0;
          for (let i = 1; i < savedPoints.length; i++) {
            const prev = savedPoints[i - 1];
            const curr = savedPoints[i];
            distance += calculateHaversineDistance(
              prev.latitude,
              prev.longitude,
              curr.latitude,
              curr.longitude
            );
          }
          totalDistance.current = distance;
          if (onDistanceUpdate && isMounted.current) {
            onDistanceUpdate(totalDistance.current);
          }
        }
      } catch (error) {
        console.error('Error al inicializar la caché de rutas:', error);
      }
    };
    
    init();

    // Limpiar al desmontar
    return () => {
      isMounted.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      
      stopBackgroundTracking();
      setTracking(false);
    };
  }, [tripId, startLocationTracking, onDistanceUpdate]);

  const stopLocationTracking = useCallback(() => {
    console.log('Deteniendo seguimiento de ubicación...');
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    stopBackgroundTracking();
    if (isMounted.current) {
      setTracking(false);
      setLocationError(null); // Limpiar el mensaje de error al detener
    }
    console.log('Seguimiento de ubicación detenido');
  }, []);
  
  // Función para manejar el cierre del diálogo de permisos
  const handleClosePermissionDialog = useCallback(() => {
    setShowPermissionDialog(false);
    // Si no estamos rastreando, verificar si podemos iniciar el seguimiento
    if (!tracking) {
      verifyLocationStatus().then(({ hasPermission, isEnabled }) => {
        if (hasPermission && isEnabled) {
          startLocationTracking().catch(console.error);
        }
      });
    }
  }, [tracking, verifyLocationStatus, startLocationTracking]);

  return (
    <div className="space-y-4">
      {permissionStatus !== 'granted' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permisos de ubicación requeridos</AlertTitle>
          <AlertDescription>
            Necesitamos acceso a tu ubicación para realizar el seguimiento del viaje.
          </AlertDescription>
          <div className="flex flex-col space-y-2 mt-2">
            <Button 
              variant="outline" 
              onClick={handleEnableLocation}
              disabled={isCheckingLocation || isRequestingPermission}
              className="w-full"
            >
              <Compass className="mr-2 h-4 w-4" />
              {isRequestingPermission ? 'Solicitando permiso...' : isCheckingLocation ? 'Verificando...' : 'Activar ubicación'}
            </Button>
            {locationError && (
              <p className="text-sm text-muted-foreground text-center">
                {locationError.includes('activa') ? (
                  <span>Ve a Configuración → Ubicación y activa el GPS</span>
                ) : (
                  <span>Necesitamos acceso a tu ubicación para continuar</span>
                )}
              </p>
            )}
          </div>
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

      <Dialog open={showPermissionDialog} onOpenChange={handleClosePermissionDialog}>
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
