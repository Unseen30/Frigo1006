import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Polyline } from '@react-google-maps/api';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase con variables de entorno
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const containerStyle = {
  width: '100%',
  height: '500px',
};

const lineOptions = {
  strokeColor: '#1E88E5',
  strokeOpacity: 1.0,
  strokeWeight: 4,
};

interface Punto {
  lat: number;
  lng: number;
}

export const MapaTrayecto = () => {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPuntos = async () => {
      try {
        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setError('Debes iniciar sesión para ver el recorrido');
          setLoading(false);
          return;
        }

        // Obtener puntos de la base de datos
        const { data, error: dbError } = await supabase
          .from('ubicaciones') // Asegúrate de que este sea el nombre correcto de tu tabla
          .select('lat, lng, timestamp')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: true });

        if (dbError) {
          console.error('❌ Error al obtener puntos:', dbError);
          setError('Error al cargar el recorrido');
          return;
        }

        if (data && data.length > 0) {
          const formato = data.map((p: any) => ({
            lat: p.lat,
            lng: p.lng,
          }));
          setPuntos(formato);
        } else {
          setError('No hay datos de ubicación disponibles');
        }
      } catch (err) {
        console.error('Error inesperado:', err);
        setError('Ocurrió un error al cargar el mapa');
      } finally {
        setLoading(false);
      }
    };

    fetchPuntos();
  }, []);

  if (loading) {
    return <p style={{ padding: '20px', textAlign: 'center' }}>🔄 Cargando recorrido...</p>;
  }

  if (error) {
    return <p style={{ padding: '20px', color: 'red', textAlign: 'center' }}>❌ {error}</p>;
  }

  if (puntos.length === 0) {
    return <p style={{ padding: '20px', textAlign: 'center' }}>No hay datos de ubicación para mostrar</p>;
  }

  // Usar la API key de Google Maps desde las variables de entorno
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!googleMapsApiKey) {
    return (
      <p style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
        ❌ Falta configurar la API key de Google Maps
      </p>
    );
  }

  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', margin: '20px 0' }}>
      <LoadScript googleMapsApiKey={googleMapsApiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={puntos[0]}
          zoom={16}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Polyline 
            path={puntos} 
            options={lineOptions} 
          />
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default MapaTrayecto;
