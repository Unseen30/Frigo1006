import { Geolocation } from '@capacitor/geolocation';

// Función para verificar si estamos en un dispositivo móvil
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const checkLocationPermissions = async (): Promise<{granted: boolean, message?: string}> => {
  // Para Android/iOS usando Capacitor
  if (isMobile()) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location === 'granted') {
        console.log('Permiso de ubicación ya concedido');
        return { granted: true };
      }
      
      console.log('Solicitando permiso de ubicación...');
      const request = await Geolocation.requestPermissions();
      const granted = request.location === 'granted';
      console.log(`Permiso de ubicación ${granted ? 'concedido' : 'denegado'}`);
      return { 
        granted,
        message: granted ? undefined : 'Se requieren permisos de ubicación para continuar. Por favor, activa los permisos en la configuración de tu dispositivo.'
      };
    } catch (error) {
      console.error('Error verificando permisos de ubicación:', error);
      return { 
        granted: false, 
        message: 'Error al verificar los permisos de ubicación. Por favor, verifica la configuración de tu dispositivo.'
      };
    }
  }
  
  // Código para navegadores web
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const message = 'La geolocalización no está disponible en este navegador. Por favor, utiliza un navegador compatible.';
      console.error(message);
      resolve({ granted: false, message });
      return;
    }

    // Verificar primero el estado del permiso
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          console.log('Estado inicial del permiso:', permissionStatus.state);
          
          // Si ya está concedido, retornar true
          if (permissionStatus.state === 'granted') {
            resolve({ granted: true });
            return;
          }
          
          // Si está denegado, retornar false con mensaje
          if (permissionStatus.state === 'denied') {
            resolve({ 
              granted: false, 
              message: 'El acceso a la ubicación está bloqueado. Por favor, permite el acceso en la configuración de tu navegador.'
            });
            return;
          }
          
          // Si está en 'prompt', configurar listener y forzar el diálogo con getCurrentPosition
          const permissionListener = (event: PermissionStatusEventMap['change']) => {
            console.log('Cambio en el estado del permiso:', event.target?.state);
            if (event.target?.state === 'granted') {
              resolve({ granted: true });
              permissionStatus.removeEventListener('change', permissionListener);
            } else if (event.target?.state === 'denied') {
              resolve({ 
                granted: false, 
                message: 'Se requiere acceso a la ubicación para continuar. Por favor, actualiza los permisos.'
              });
              permissionStatus.removeEventListener('change', permissionListener);
            }
          };
          
          permissionStatus.addEventListener('change', permissionListener);
          
          // Forzar el diálogo de permisos
          navigator.geolocation.getCurrentPosition(
            () => {
              // Éxito, el listener se encargará de resolver la promesa
            },
            (error) => {
              console.error('Error al solicitar ubicación:', error);
              // Si hay error, el listener ya manejará el estado
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
          
          // Configurar timeout para evitar bloqueos
          setTimeout(() => {
            if (!permissionStatus) return;
            permissionStatus.removeEventListener('change', permissionListener);
            if (permissionStatus.state === 'prompt') {
              resolve({ 
                granted: false, 
                message: 'No se recibió respuesta del diálogo de permisos. Por favor, verifica la configuración de tu navegador.'
              });
            }
          }, 10000);
          
        })
        .catch((error) => {
          console.error('Error al verificar permisos:', error);
          resolve({ 
            granted: false, 
            message: 'Error al verificar los permisos de ubicación.'
          });
        });
    } else {
      // Para navegadores antiguos que no soportan la API de permisos
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true }),
        (error) => {
          console.error('Error al obtener ubicación:', error);
          let message = 'No se pudo acceder a la ubicación. ';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              message += 'Permiso denegado. Por favor, activa los permisos de ubicación en la configuración de tu navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              message += 'La información de ubicación no está disponible. Asegúrate de tener activado el GPS.';
              break;
            case error.TIMEOUT:
              message += 'Tiempo de espera agotado. Por favor, intenta de nuevo en un lugar con mejor señal.';
              break;
            default:
              message += 'Error desconocido al acceder a la ubicación.';
          }
          
          resolve({ granted: false, message });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  });
};

export const requestLocationPermissions = async (): Promise<{granted: boolean, message?: string}> => {
  // Primero verificamos el estado actual de los permisos
  const { granted, message } = await checkLocationPermissions();
  
  if (granted) {
    return { granted: true };
  }
  
  // Si estamos en un dispositivo móvil, ya se solicitó el permiso en checkLocationPermissions
  if (isMobile()) {
    return { 
      granted: false, 
      message: message || 'No se pudo obtener el permiso de ubicación. Por favor, verifica la configuración de tu dispositivo.'
    };
  }
  
  // Para navegadores web, forzar el diálogo de permisos
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const errorMsg = 'La geolocalización no está disponible en este navegador';
      console.error(errorMsg);
      resolve({ 
        granted: false, 
        message: errorMsg + ' Por favor, utiliza un navegador compatible.'
      });
      return;
    }

    console.log('Solicitando permisos de ubicación...');
    
    // Configurar un timeout para evitar que la promesa quede colgada
    const timeoutId = setTimeout(() => {
      console.warn('Tiempo de espera agotado para la solicitud de ubicación');
      resolve({ 
        granted: false, 
        message: 'Tiempo de espera agotado. Por favor, verifica que hayas respondido al diálogo de permisos.'
      });
    }, 15000);
    
    // Intentar con getCurrentPosition para forzar el diálogo
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        console.log('Ubicación obtenida correctamente');
        resolve({ granted: true });
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error('Error al obtener ubicación:', error);
        
        let errorMessage = 'No se pudo acceder a la ubicación. ';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permiso denegado. ';
            // Intentar abrir configuración si es una app móvil
            if ((window as any).cordova && (window as any).cordova.plugins?.settings) {
              console.log('Abriendo configuración de ubicación...');
              (window as any).cordova.plugins.settings.open('location_source_settings');
              errorMessage += 'Se ha abierto la configuración de ubicación. Por favor, activa los permisos y vuelve a intentarlo.';
            } else {
              errorMessage += 'Por favor, activa los permisos de ubicación en la configuración de tu navegador.';
            }
            break;
            
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'La información de ubicación no está disponible. Asegúrate de tener activado el GPS y conexión a internet.';
            break;
            
          case error.TIMEOUT:
            errorMessage += 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.';
            break;
            
          default:
            errorMessage += 'Error desconocido al acceder a la ubicación.';
        }
        
        console.error('Error en requestLocationPermissions:', errorMessage);
        resolve({ granted: false, message: errorMessage });
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  });
};

export const checkLocationEnabled = async (): Promise<{enabled: boolean, message?: string}> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        enabled: false,
        message: 'La geolocalización no está disponible en este navegador.'
      });
      return;
    }

    // Primero verificamos los permisos
    checkLocationPermissions().then(({granted, message}) => {
      if (!granted) {
        resolve({
          enabled: false,
          message: message || 'Se requieren permisos de ubicación para verificar si está activada.'
        });
        return;
      }
      
      // Si tenemos permisos, intentamos obtener la ubicación
      const timeoutId = setTimeout(() => {
        console.warn('Tiempo de espera agotado al verificar la ubicación');
        resolve({
          enabled: false,
          message: 'No se pudo verificar el estado de la ubicación. Asegúrate de que el GPS esté activado.'
        });
      }, 15000);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          // Verificar si la ubicación es válida
          if (position && position.coords && 
              !isNaN(position.coords.latitude) && 
              !isNaN(position.coords.longitude)) {
            resolve({ enabled: true });
          } else {
            resolve({
              enabled: false,
              message: 'La ubicación obtenida no es válida.'
            });
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Error al verificar la ubicación:', error);
          
          let errorMessage = 'No se pudo verificar la ubicación. ';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Permiso denegado. Por favor, activa los permisos de ubicación.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'La información de ubicación no está disponible. Asegúrate de tener activado el GPS.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Tiempo de espera agotado. Por favor, verifica tu conexión y GPS.';
              break;
            default:
              errorMessage += 'Error desconocido al acceder a la ubicación.';
          }
          
          resolve({
            enabled: false,
            message: errorMessage
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
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
