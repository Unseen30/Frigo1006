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
      resolve(false);
      return;
    }

    // Intentar obtener la ubicación para activar el diálogo de permisos
    navigator.geolocation.getCurrentPosition(
      () => {
        // Permiso concedido
        resolve(true);
      },
      (error) => {
        console.error('Error al solicitar permisos de ubicación:', error);
        // Mostrar mensaje de error según el código de error
        let errorMessage = 'No se pudo acceder a la ubicación';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'La información de ubicación no está disponible';
            break;
          case error.TIMEOUT:
            errorMessage = 'La solicitud de ubicación ha expirado';
            break;
        }
        toast.error(errorMessage);
        resolve(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 5000,
        maximumAge: 0 // No usar caché
      }
    );
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
