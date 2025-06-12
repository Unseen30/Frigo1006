import { Geolocation } from '@capacitor/geolocation';
import { isPlatform } from '@ionic/react';

export const checkLocationPermissions = async (): Promise<boolean> => {
  // Para Android/iOS usando Capacitor
  if (isPlatform('android') || isPlatform('ios')) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location === 'granted') return true;
      
      const request = await Geolocation.requestPermissions();
      return request.location === 'granted';
    } catch (error) {
      console.error('Error verificando permisos de ubicación:', error);
      return false;
    }
  }
  
  // Código para navegadores web
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.error('La geolocalización no está disponible en este navegador');
      resolve(false);
      return;
    }

    // Primero intentamos con getCurrentPosition para forzar el diálogo si es necesario
    navigator.geolocation.getCurrentPosition(
      () => {
        // Si llegamos aquí, los permisos están concedidos
        console.log('Permisos de ubicación concedidos (getCurrentPosition)');
        resolve(true);
      },
      (error) => {
        console.log('Error en getCurrentPosition:', error);
        // Si hay un error, verificamos el estado del permiso
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' as PermissionName })
            .then((permissionStatus) => {
              console.log('Estado del permiso:', permissionStatus.state);
              if (permissionStatus.state === 'granted') {
                resolve(true);
              } else {
                // Configuramos un listener para cambios en el permiso
                const permissionListener = (event: any) => {
                  console.log('Cambio en el estado del permiso:', event.target.state);
                  if (event.target.state === 'granted') {
                    resolve(true);
                    permissionStatus.removeEventListener('change', permissionListener);
                  }
                };
                permissionStatus.addEventListener('change', permissionListener);
                resolve(false);
              }
            })
            .catch((error) => {
              console.error('Error al verificar permisos:', error);
              resolve(false);
            });
        } else {
          resolve(false);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
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

    console.log('Solicitando permisos de ubicación...');
    
    // Primero intentamos con getCurrentPosition para forzar el diálogo
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Ubicación obtenida correctamente');
        toast.success('Permiso de ubicación concedido');
        resolve(true);
      },
      async (error) => {
        console.error('Error al obtener ubicación:', error);
        
        // Verificar si es un error de permisos
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Permiso de ubicación denegado', {
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
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('La información de ubicación no está disponible. Asegúrate de tener activado el GPS.');
        } else if (error.code === error.TIMEOUT) {
          toast.error('La solicitud de ubicación ha expirado. Intenta de nuevo.');
        } else {
          toast.error('No se pudo acceder a la ubicación');
        }
        
        // Verificar el estado del permiso
        if (navigator.permissions) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            console.log('Estado del permiso después del error:', permissionStatus.state);
            
            if (permissionStatus.state === 'granted') {
              resolve(true);
              return;
            }
            
            // Configurar un listener para cambios en el permiso
            const permissionListener = (event: any) => {
              console.log('Cambio en el estado del permiso (request):', event.target.state);
              if (event.target.state === 'granted') {
                toast.success('Permiso de ubicación concedido');
                resolve(true);
                permissionStatus.removeEventListener('change', permissionListener);
              }
            };
            
            permissionStatus.addEventListener('change', permissionListener);
            
            // Si el permiso está en prompt, devolvemos false para que la interfaz lo maneje
            resolve(false);
          } catch (permissionError) {
            console.error('Error al verificar permisos:', permissionError);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
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
