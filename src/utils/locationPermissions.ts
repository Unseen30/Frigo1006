import { Geolocation } from '@capacitor/geolocation';

// Función para verificar si estamos en un dispositivo móvil
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Variable para rastrear si ya se mostró el diálogo de permisos
let permissionRequestInProgress = false;

// Tiempos de espera en milisegundos
const TIMEOUTS = {
  PERMISSION_PROMPT: 15000,    // 15 segundos para responder al diálogo de permisos
  LOCATION_ACQUISITION: 30000, // 30 segundos para obtener la ubicación
  LOCATION_VERIFICATION: 10000 // 10 segundos para verificar la ubicación
};

/**
 * Verifica los permisos de ubicación actuales y los solicita si es necesario
 * @returns Objeto con el estado de los permisos y un mensaje opcional
 */
export const checkLocationPermissions = async (): Promise<{granted: boolean, message?: string}> => {
  // Si ya hay una solicitud de permiso en curso, no iniciar otra
  if (permissionRequestInProgress) {
    console.log('⚠️ Ya hay una solicitud de permisos en curso');
    return { granted: false, message: 'Ya hay una solicitud de permisos en curso' };
  }
  
  permissionRequestInProgress = true;
  
  try {
    // Para Android/iOS usando Capacitor
    if (isMobile()) {
      console.log('📱 Dispositivo móvil detectado, usando Capacitor Geolocation');
      try {
        // Verificar permisos actuales
        const permission = await Geolocation.checkPermissions();
        console.log('🔍 Estado actual de los permisos:', permission);
        
        // Si ya están concedidos, retornar true
        if (permission.location === 'granted') {
          console.log('✅ Permiso de ubicación ya concedido');
          return { granted: true };
        }
        
        // Si no están concedidos, solicitarlos
        console.log('🔍 Solicitando permiso de ubicación...');
        const request = await Geolocation.requestPermissions();
        console.log('📝 Respuesta de la solicitud de permisos:', request);
        
        const granted = request.location === 'granted';
        console.log(`🔔 Permiso de ubicación ${granted ? '✅ concedido' : '❌ denegado'}`);
        
        return { 
          granted,
          message: granted ? undefined : 'Se requieren permisos de ubicación para continuar. Por favor, activa los permisos en la configuración de tu dispositivo.'
        };
      } catch (error) {
        console.error('❌ Error verificando permisos de ubicación:', error);
        return { 
          granted: false, 
          message: 'Error al verificar los permisos de ubicación. Por favor, verifica la configuración de tu dispositivo.'
        };
      }
    } else {
      // Para navegadores web
      console.log('🌐 Navegador web detectado, usando API de geolocalización del navegador');
      
      // Verificar si el navegador soporta geolocalización
      if (!navigator.geolocation) {
        const message = 'La geolocalización no está disponible en este navegador. Por favor, utiliza un navegador compatible como Chrome, Firefox o Edge.';
        console.error('❌ ' + message);
        return { granted: false, message };
      }

      // Si el navegador soporta la API de permisos, usarla para verificar el estado
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' } as PermissionDescriptor);
          console.log('🔍 Estado actual del permiso:', permissionStatus.state);
          
          // Si ya está concedido, retornar true
          if (permissionStatus.state === 'granted') {
            console.log('✅ Permiso de ubicación ya concedido en el navegador');
            return { granted: true };
          }
          
          // Si está denegado, retornar false con mensaje
          if (permissionStatus.state === 'denied') {
            const message = 'El acceso a la ubicación está bloqueado. Por favor, permite el acceso en la configuración de tu navegador.';
            console.warn('⚠️ ' + message);
            return { granted: false, message };
          }
          
          // Si está en 'prompt', forzar el diálogo con getCurrentPosition
          console.log('🔍 El navegador está listo para solicitar permisos');
          
          // Crear una promesa que se resolverá cuando el usuario responda al diálogo
          return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              console.warn('⏱️ Tiempo de espera agotado para la respuesta de permisos');
              permissionStatus.removeEventListener('change', permissionChangeHandler);
              resolve({ 
                granted: false, 
                message: 'Tiempo de espera agotado. Por favor, verifica que hayas respondido al diálogo de permisos.'
              });
            }, TIMEOUTS.PERMISSION_PROMPT);
            
            // Manejador de cambios en el estado del permiso
            const permissionChangeHandler = (event: Event) => {
              const status = event.target as PermissionStatus;
              console.log('🔄 Cambio en el estado del permiso:', status.state);
              
              if (status.state === 'granted') {
                clearTimeout(timeoutId);
                permissionStatus.removeEventListener('change', permissionChangeHandler);
                console.log('✅ Permiso concedido después del diálogo');
                resolve({ granted: true });
              } else if (status.state === 'denied') {
                clearTimeout(timeoutId);
                permissionStatus.removeEventListener('change', permissionChangeHandler);
                console.warn('❌ Permiso denegado después del diálogo');
                resolve({ 
                  granted: false, 
                  message: 'Se requiere acceso a la ubicación para continuar. Por favor, actualiza los permisos.'
                });
              }
            };
            
            // Agregar el manejador de cambios
            permissionStatus.addEventListener('change', permissionChangeHandler);
            
            // Forzar el diálogo de permisos
            console.log('🔄 Solicitando ubicación para mostrar el diálogo de permisos...');
            navigator.geolocation.getCurrentPosition(
              () => {
                // Éxito, el manejador de cambios se encargará de resolver la promesa
                console.log('📍 Ubicación obtenida, esperando respuesta del usuario...');
              },
              (error) => {
                // Error, pero el manejador de cambios se encargará de manejar el estado
                console.error('⚠️ Error al solicitar ubicación:', error);
              },
              { 
                enableHighAccuracy: true, 
                timeout: TIMEOUTS.LOCATION_VERIFICATION, 
                maximumAge: 0 
              }
            );
          });
          
        } catch (error) {
          console.error('❌ Error al verificar permisos:', error);
          return { 
            granted: false, 
            message: 'Error al verificar los permisos de ubicación. Por favor, inténtalo de nuevo.'
          };
        }
      } else {
        // Para navegadores antiguos que no soportan la API de permisos
        console.log('ℹ️ Navegador no soporta la API de permisos, usando método alternativo');
        
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            console.warn('⏱️ Tiempo de espera agotado para la respuesta de permisos');
            resolve({ 
              granted: false, 
              message: 'Tiempo de espera agotado. Por favor, verifica que hayas respondido al diálogo de permisos.'
            });
          }, TIMEOUTS.PERMISSION_PROMPT);
          
          navigator.geolocation.getCurrentPosition(
            () => {
              clearTimeout(timeoutId);
              console.log('✅ Ubicación obtenida correctamente');
              resolve({ granted: true });
            },
            (error) => {
              clearTimeout(timeoutId);
              console.error('❌ Error al obtener ubicación:', error);
              
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
            { 
              enableHighAccuracy: true, 
              timeout: TIMEOUTS.LOCATION_VERIFICATION, 
              maximumAge: 0 
            }
          );
        });
      }
    }
  } catch (error) {
    console.error('❌ Error inesperado en checkLocationPermissions:', error);
    return { 
      granted: false, 
      message: 'Error inesperado al verificar los permisos. Por favor, inténtalo de nuevo.'
    };
  } finally {
    // Restablecer el estado de la solicitud de permiso
    permissionRequestInProgress = false;
  }
};

/**
 * Solicita permisos de ubicación al usuario
 * @returns Objeto con el estado de los permisos y un mensaje opcional
 */
export const requestLocationPermissions = async (): Promise<{granted: boolean, message?: string}> => {
  // Simplemente llamamos a checkLocationPermissions ya que ya maneja la solicitud de permisos
  return checkLocationPermissions();
};

/**
 * Verifica si la ubicación está habilitada en el dispositivo
 * @returns Objeto con el estado de la ubicación y un mensaje opcional
 */
export const checkLocationEnabled = async (): Promise<{enabled: boolean, message?: string}> => {
  try {
    // Primero verificamos los permisos
    const { granted, message: permissionMessage } = await checkLocationPermissions();
    
    if (!granted) {
      return { 
        enabled: false, 
        message: permissionMessage || 'Se requieren permisos de ubicación para verificar si está activada.'
      };
    }
    
    // Si tenemos permisos, intentamos obtener la ubicación
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('⏱️ Tiempo de espera agotado al verificar la ubicación');
        resolve({
          enabled: false,
          message: 'No se pudo verificar el estado de la ubicación. Asegúrate de que el GPS esté activado.'
        });
      }, TIMEOUTS.LOCATION_VERIFICATION);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          // Verificar si la ubicación es válida
          if (position && position.coords && 
              !isNaN(position.coords.latitude) && 
              !isNaN(position.coords.longitude)) {
            console.log('📍 Ubicación obtenida correctamente:', position.coords);
            resolve({ enabled: true });
          } else {
            console.warn('⚠️ Ubicación obtenida pero no es válida');
            resolve({
              enabled: false,
              message: 'La ubicación obtenida no es válida.'
            });
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('❌ Error al verificar la ubicación:', error);
          
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
          timeout: TIMEOUTS.LOCATION_VERIFICATION,
          maximumAge: 0
        }
      );
    });
  } catch (error) {
    console.error('❌ Error inesperado en checkLocationEnabled:', error);
    return { 
      enabled: false, 
      message: 'Error inesperado al verificar la ubicación. Por favor, inténtalo de nuevo.'
    };
  }
};

/**
 * Solicita al usuario que active la configuración de ubicación
 * @returns Promesa que resuelve a true si la ubicación está activada, false en caso contrario
 */
export const requestLocationSettings = async (): Promise<boolean> => {
  try {
    // Primero verificamos si la ubicación ya está activada
    const { enabled } = await checkLocationEnabled();
    if (enabled) {
      return true;
    }
    
    // Si no está activada, mostramos un mensaje al usuario
    console.log('ℹ️ Solicitando al usuario que active la ubicación');
    
    // En navegadores web, no podemos abrir directamente la configuración de ubicación
    // Simplemente devolvemos false para indicar que el usuario debe activarla manualmente
    return false;
    
  } catch (error) {
    console.error('❌ Error al verificar la configuración de ubicación:', error);
    return false;
  }
};
