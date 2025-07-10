import React, { useState, useEffect, useCallback } from 'react';
import { useTracking } from '../hooks/useTracking';
import { Geolocation, Position } from '@capacitor/geolocation';
import { createClient } from '@supabase/supabase-js';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Solución temporal para el ícono del marcador
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Configuración de Supabase
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

export default function Seguimiento() {
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaUbicacion, setUltimaUbicacion] = useState<{lat: number, lng: number, timestamp: string} | null>(null);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<boolean>(false);
  const [rutaViaje, setRutaViaje] = useState<Array<[number, number]>>([]);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [cargandoRuta, setCargandoRuta] = useState(false);

  // Verificar autenticación y permisos al cargar el componente
  useEffect(() => {
    const verificarAutenticacionYPermisos = async () => {
      try {
        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        setUsuarioAutenticado(!!user);
        
        if (!user) {
          setError('Debes iniciar sesión para usar el seguimiento');
          return;
        }

        // Verificar permisos de ubicación
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          setError('Por favor, otorga permisos de ubicación para continuar');
        }
      } catch (error) {
        console.error('Error al verificar autenticación o permisos:', error);
        setError('Error al verificar la autenticación o permisos');
      }
    };

    verificarAutenticacionYPermisos();
  }, []);

  // Usar el hook de seguimiento
  const { 
    error: trackingError, 
    obtenerRutaViaje, 
    finalizarViaje,
    viajeActivo,
    idViajeActual
  } = useTracking(activo);

  // Actualizar el estado de error si hay un error en el hook
  useEffect(() => {
    if (trackingError) {
      setError(trackingError);
    }
  }, [trackingError]);

  // Efecto para cargar la ruta cuando se desactiva el seguimiento
  useEffect(() => {
    const cargarRuta = async () => {
      if (!activo && idViajeActual) {
        setCargandoRuta(true);
        try {
          const ubicaciones = await obtenerRutaViaje(idViajeActual);
          const coordenadas = ubicaciones.map(u => [u.lat, u.lng] as [number, number]);
          setRutaViaje(coordenadas);
          setMostrarMapa(coordenadas.length > 0);
        } catch (error) {
          console.error('Error al cargar la ruta:', error);
          setError('No se pudo cargar la ruta del viaje');
        } finally {
          setCargandoRuta(false);
        }
      }
    };

    cargarRuta();
  }, [activo, idViajeActual, obtenerRutaViaje]);

  // Función para finalizar el viaje
  const manejarFinalizarViaje = async () => {
    const resultado = await finalizarViaje();
    if (resultado.success) {
      setActivo(false);
      setError(null);
    } else {
      setError(resultado.error || 'Error al finalizar el viaje');
    }
  };

  // Obtener la ubicación actual al hacer clic en el botón
  const obtenerUbicacionActual = async () => {
    if (!usuarioAutenticado) {
      setError('Debes iniciar sesión para obtener tu ubicación');
      return;
    }

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      });
      
      const nuevaUbicacion = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setUltimaUbicacion(nuevaUbicacion);
      setError(null);
    } catch (err) {
      console.error('Error al obtener la ubicación:', err);
      setError('No se pudo obtener la ubicación actual');
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      padding: '20px',
      maxWidth: '100%',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
    } as const,
    titulo: {
      color: '#333',
      textAlign: 'center' as const,
      marginBottom: '20px',
    } as const,
    botonesContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '10px',
      marginBottom: '20px',
      justifyContent: 'center',
    } as const,
    boton: {
      padding: '12px 24px',
      borderRadius: '8px',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      backgroundColor: '#2196F3',
    } as const,
    error: {
      color: '#d32f2f',
      margin: '10px 0',
      padding: '12px',
      backgroundColor: '#ffebee',
      borderRadius: '6px',
      borderLeft: '4px solid #f44336',
      fontWeight: 500,
    } as const,
    info: {
      color: '#1976d2',
      margin: '10px 0',
      padding: '12px',
      backgroundColor: '#e3f2fd',
      borderRadius: '6px',
      borderLeft: '4px solid #2196f3',
      fontWeight: 500,
    } as const,
    mapaContainer: {
      margin: '20px 0',
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    } as const,
    mapa: {
      height: '400px',
      width: '100%',
      borderRadius: '8px',
      marginTop: '10px',
      border: '1px solid #ddd',
    } as const,
    ubicacionContainer: {
      marginTop: '20px',
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    } as const,
    enlaceMapa: {
      display: 'inline-block',
      marginTop: '10px',
      color: '#1976D2',
      textDecoration: 'none',
      fontWeight: 'bold' as const,
    } as const,
    estado: {
      textAlign: 'center' as const,
      fontSize: '14px',
      color: '#666',
      marginTop: '20px',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.titulo}>Seguimiento de Viaje</h1>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.botonesContainer}>
        {activo ? (
          <button 
            onClick={manejarFinalizarViaje}
            style={{
              ...styles.boton,
              backgroundColor: '#ff4444',
            }}
          >
            🏁 Finalizar Viaje
          </button>
        )}
        
        <button 
  container: {
    padding: '20px',
    maxWidth: '100%',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  titulo: {
    color: '#333',
    textAlign: 'center' as const,
    marginBottom: '20px',
  },
  botonesContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    marginBottom: '20px',
    justifyContent: 'center',
  },
  boton: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    backgroundColor: '#2196F3',
  },
  error: {
    color: '#d32f2f',
    margin: '10px 0',
    padding: '12px',
    backgroundColor: '#ffebee',
    borderRadius: '6px',
    borderLeft: '4px solid #f44336',
    fontWeight: 500,
  },
  info: {
    color: '#1976d2',
    margin: '10px 0',
    padding: '12px',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    borderLeft: '4px solid #2196f3',
    fontWeight: 500,
  },
  mapaContainer: {
    margin: '20px 0',
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  mapa: {
    height: '400px',
    width: '100%',
    borderRadius: '8px',
    marginTop: '10px',
    border: '1px solid #ddd',
  },
  ubicacionContainer: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  enlaceMapa: {
    display: 'inline-block',
    marginTop: '10px',
    color: '#1976D2',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
  },
  estado: {
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#666',
    marginTop: '20px',
  },
};
