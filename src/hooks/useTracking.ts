import { useEffect, useRef, useState } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase con las variables de entorno
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Ubicacion {
  id: number;
  user_id: string;
  lat: number;
  lng: number;
  timestamp: string;
  viaje_id?: string;
}

interface UseTrackingReturn {
  error: string | null;
  obtenerRutaViaje: (viajeId: string) => Promise<Ubicacion[]>;
  finalizarViaje: () => Promise<{ success: boolean; viajeId?: string; error?: string }>;
  viajeActivo: boolean;
  idViajeActual: string | null;
  distanciaRecorrida: number;
  actualizarDistancia: (nuevaDistancia: number) => void;
}

export function useTracking(activar: boolean): UseTrackingReturn {
  const watchId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idViajeActual, setIdViajeActual] = useState<string | null>(null);
  const [viajeActivo, setViajeActivo] = useState(false);
  const [distanciaRecorrida, setDistanciaRecorrida] = useState<number>(0);

  // Función para obtener la ruta de un viaje
  const obtenerRutaViaje = async (viajeId: string): Promise<Ubicacion[]> => {
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('*')
      .eq('viaje_id', viajeId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('Error al obtener la ruta:', error);
      return [];
    }
    
    return data || [];
  };

  // Función para finalizar un viaje
  const finalizarViaje = async () => {
    if (!idViajeActual) {
      return { success: false, error: 'No hay un viaje activo' };
    }

    try {
      const { error } = await supabase
        .from('viajes')
        .update({ finalizado: true, fecha_fin: new Date().toISOString() })
        .eq('id', idViajeActual);

      if (error) throw error;
      
      setViajeActivo(false);
      const viajeFinalizadoId = idViajeActual;
      setIdViajeActual(null);
      return { success: true, viajeId: viajeFinalizadoId };
    } catch (error) {
      console.error('Error al finalizar el viaje:', error);
      return { success: false, error: 'Error al finalizar el viaje' };
    }
  };

  useEffect(() => {
    const startTracking = async () => {
      try {
        // Verificar si ya hay un watcher activo
        if (watchId.current !== null) {
          await Geolocation.clearWatch({ id: watchId.current });
          watchId.current = null;
        }

        // Obtener el usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.warn('Usuario no autenticado');
          return;
        }

        // Pedir permisos
        const perm = await Geolocation.requestPermissions();

        if (perm.location !== 'granted') {
          console.warn('Permiso de ubicación denegado');
          return;
        }

        // Iniciar el seguimiento
        const id = await Geolocation.watchPosition(
          { 
            enableHighAccuracy: true, 
            timeout: 10000,
            maximumAge: 1000 
          },
          async (pos: Position | null) => {
            if (!pos) return;
            
            const { latitude, longitude } = pos.coords;
            const timestamp = new Date().toISOString();

            console.log('📍 Guardando punto', { latitude, longitude, timestamp });

            // Guardar en Supabase
            try {
              const { data, error } = await supabase
                .from('ubicaciones')
                .insert([
                  {
                    user_id: user.id,
                    lat: latitude,
                    lng: longitude,
                    timestamp,
                    viaje_id: idViajeActual || undefined,
                  },
                ])
                .select()
                .single();

              if (error) {
                console.error('Error al guardar ubicación:', error);
              }
            } catch (error) {
              console.error('Error en la petición a Supabase:', error);
            }
          }
        );

        watchId.current = id;
      } catch (error) {
        console.error('Error en el seguimiento de ubicación:', error);
      }
    };

    if (activar) {
      const iniciarViaje = async () => {
        const { data } = await supabase
          .from('viajes')
          .insert([{ user_id: (await supabase.auth.getUser()).data.user?.id }])
          .select()
          .single();
        
        if (data) {
          setIdViajeActual(data.id);
          setViajeActivo(true);
          startTracking();
        }
      };
      
      iniciarViaje();
    } else if (!activar && viajeActivo) {
      setViajeActivo(false);
    }


    return () => {
      const cleanup = async () => {
        if (watchId.current !== null) {
          try {
            await Geolocation.clearWatch({ id: watchId.current });
            watchId.current = null;
          } catch (error) {
            console.error('Error al limpiar el watcher:', error);
          }
        }
      };

      cleanup();
    };
  }, [activar]);

  const actualizarDistancia = async (nuevaDistancia: number) => {
    setDistanciaRecorrida(nuevaDistancia);
    
    if (idViajeActual) {
      await supabase
        .from('viajes')
        .update({ distance: nuevaDistancia })
        .eq('id', idViajeActual);
    }
  };

  return { 
    error, 
    obtenerRutaViaje,
    finalizarViaje,
    viajeActivo,
    idViajeActual,
    distanciaRecorrida,
    actualizarDistancia
  };
}
