import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';

export const checkLocationPermissions = async (): Promise<boolean> => {
  try {
    // Verificar si el plugin de geolocalización está disponible
    if (typeof Geolocation === 'undefined') {
      throw new Error('La geolocalización no está disponible en este dispositivo');
    }

    // Verificar permisos
    const permissionStatus = await Geolocation.checkPermissions();
    
    if (permissionStatus.location === 'granted') {
      return true;
    }

    // Si no se han otorgado permisos, solicitarlos
    const requestStatus = await Geolocation.requestPermissions({
      permissions: ['location']
    });

    if (requestStatus.location === 'granted') {
      return true;
    }

    // Si el usuario deniega los permisos
    if (requestStatus.location === 'denied') {
      toast.error('Se requieren permisos de ubicación para esta función');
      return false;
    }

    return false;
  } catch (error: any) {
    console.error('Error al verificar permisos de ubicación:', error);
    toast.error('Error al verificar los permisos de ubicación');
    return false;
  }
};

export const checkLocationEnabled = async (): Promise<boolean> => {
  try {
    // Verificar si el servicio de ubicación está habilitado
    const enabled = await Geolocation.checkPermissions().then(async (status) => {
      if (status.location !== 'granted') return false;
      
      try {
        // Intentar obtener la posición actual para verificar si la ubicación está activa
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        return position !== null;
      } catch (error) {
        console.error('Error al obtener la ubicación:', error);
        return false;
      }
    });

    return enabled;
  } catch (error) {
    console.error('Error al verificar el estado de la ubicación:', error);
    return false;
  }
};

export const requestLocationSettings = async (): Promise<boolean> => {
  try {
    // Abrir la configuración de ubicación del dispositivo
    await Geolocation.requestPermissions({
      permissions: ['location']
    });
    
    // Verificar nuevamente después de abrir la configuración
    return await checkLocationEnabled();
  } catch (error) {
    console.error('Error al abrir la configuración de ubicación:', error);
    return false;
  }
};
