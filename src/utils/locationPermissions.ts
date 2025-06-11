import { toast } from 'sonner';

export const checkLocationPermissions = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      toast.error('La geolocalización no está disponible en este navegador');
      resolve(false);
      return;
    }

    // Verificar permisos usando la API de Permissions si está disponible
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            resolve(true);
          } else if (permissionStatus.state === 'prompt') {
            // Si está en modo 'prompt', intentamos obtener la ubicación para activar el diálogo
            navigator.geolocation.getCurrentPosition(
              () => resolve(true),
              () => resolve(false),
              { enableHighAccuracy: true, timeout: 5000 }
            );
          } else {
            resolve(false);
          }
        })
        .catch(() => {
          // Si falla la API de Permissions, intentamos directamente
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
    } else {
      // Para navegadores que no soportan la API de Permissions
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 5000 }
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
