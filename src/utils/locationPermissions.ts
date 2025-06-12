import { toast } from 'sonner';

export const checkLocationPermissions = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.error('La geolocalización no está disponible en este navegador');
      resolve(false);
      return;
    }

    if (navigator.permissions) {
      // Usar la API de Permissions si está disponible
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch(() => {
          // Fallback para navegadores que no soportan la API de Permissions
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { enableHighAccuracy: true, timeout: 1000 }
          );
        });
    } else {
      // Para navegadores que no soportan la API de Permissions
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 1000 }
      );
    }
  });
};

export const requestLocationPermissions = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.error('La geolocalización no está disponible en este navegador');
      toast.error('La geolocalización no está disponible en este dispositivo');
      resolve(false);
      return;
    }

    // Primero verificamos el estado del permiso
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(async (permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            resolve(true);
            return;
          }
          
          // Si el permiso no está concedido, intentamos obtener la ubicación
          // para activar el diálogo de permisos
          try {
            const position = await new Promise<GeolocationPosition>((positionResolve, positionReject) => {
              navigator.geolocation.getCurrentPosition(
                positionResolve,
                positionReject,
                { 
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
                }
              );
            });
            
            // Si llegamos aquí, el permiso fue concedido
            toast.success('Permiso de ubicación concedido');
            resolve(true);
          } catch (error: any) {
            console.error('Error al solicitar permisos de ubicación:', error);
            let errorMessage = 'No se pudo acceder a la ubicación';
            
            if (error.code === error.PERMISSION_DENIED) {
              errorMessage = 'Permiso de ubicación denegado. Por favor, activa los permisos de ubicación en la configuración de tu dispositivo.';
              
              // Intentar abrir la configuración de la aplicación en Android
              if ((window as any).cordova && (window as any).cordova.plugins.settings) {
                (window as any).cordova.plugins.settings.open('location_source_settings');
              }
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              errorMessage = 'La información de ubicación no está disponible. Asegúrate de tener activado el GPS.';
            } else if (error.code === error.TIMEOUT) {
              errorMessage = 'La solicitud de ubicación ha expirado. Intenta de nuevo.';
            }
            
            toast.error(errorMessage, {
              duration: 5000,
              action: {
                label: 'Configuración',
                onClick: () => {
                  if ((window as any).cordova && (window as any).cordova.plugins.settings) {
                    (window as any).cordova.plugins.settings.open('location_source_settings');
                  }
                }
              }
            });
            
            resolve(false);
          }
        });
    } else {
      // Fallback para navegadores que no soportan la API de Permissions
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (error) => {
          console.error('Error al verificar la ubicación:', error);
          toast.error('No se pudo acceder a la ubicación');
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  });
};

export const checkLocationEnabled = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Verificar si la ubicación es válida
        if (position && position.coords && 
            !isNaN(position.coords.latitude) && 
            !isNaN(position.coords.longitude)) {
          resolve(true);
        } else {
          resolve(false);
        }
      },
      (error) => {
        console.error('Error al verificar la ubicación:', error);
        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

export const requestLocationSettings = async (): Promise<boolean> => {
  // En navegadores web, no podemos abrir directamente la configuración de ubicación
  // Simulamos el comportamiento solicitando permisos nuevamente
  try {
    const hasPermission = await checkLocationPermissions();
    if (hasPermission) {
      const isEnabled = await checkLocationEnabled();
      return isEnabled;
    }
    return false;
  } catch (error) {
    console.error('Error al verificar la configuración de ubicación:', error);
    return false;
  }
};
