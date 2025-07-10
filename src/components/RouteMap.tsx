
import { useEffect, useRef, useState } from "react";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDetailedRoute } from "@/services/orsService";

interface RouteMapProps {
  className?: string;
  routePoints?: { latitude: number; longitude: number }[];
}

// Función auxiliar para dibujar línea recta entre puntos
const drawStraightLine = (map: L.Map, points: [number, number][]) => {
  const polyline = L.polyline(points, {
    color: '#9ca3af',
    weight: 3,
    opacity: 0.7,
    dashArray: '5, 5',
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(map);
  
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds.pad(0.1));
  return polyline;
};

const RouteMap = ({ className = "", routePoints = [] }: RouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fix para los marcadores por defecto de Leaflet
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  // Obtener la ruta cuando cambien los puntos
  useEffect(() => {
    const fetchRoute = async () => {
      if (routePoints.length < 2) {
        console.log('No hay suficientes puntos para calcular la ruta');
        return;
      }

      console.log('Calculando ruta con', routePoints.length, 'puntos');
      setIsLoading(true);
      setError(null);
      setRouteData(null);

      try {
        const data = await getDetailedRoute(routePoints);
        console.log('Ruta obtenida correctamente', data);
        if (!data || !data.features || data.features.length === 0) {
          throw new Error('La ruta devuelta está vacía');
        }
        setRouteData(data);
      } catch (err) {
        console.error('Error al obtener la ruta detallada:', err);
        setError('No se pudo calcular la ruta óptima. Mostrando línea recta entre puntos.');
        // Limpiar datos de ruta para forzar el modo de línea recta
        setRouteData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoute();
  }, [routePoints]);

  // Inicializar el mapa y agregar la ruta
  useEffect(() => {
    if (!mapRef.current || routePoints.length === 0) return;

    console.log("Inicializando mapa de ruta con", routePoints.length, "puntos");
    
    // Crear el mapa
    const map = L.map(mapRef.current, {
      zoom: 8,
    });

    // Agregar capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Convertir puntos de ruta a formato LatLng
    const latLngs: [number, number][] = routePoints.map(point => [
      Number(point.latitude),
      Number(point.longitude)
    ]);

    // Si tenemos datos de ruta, usarlos; de lo contrario, mostrar línea recta
    if (routeData?.features?.[0]?.geometry) {
      console.log('Mostrando ruta calculada');
      try {
        const route = L.geoJSON(routeData.features[0].geometry, {
          style: {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round'
          }
        }).addTo(map);
        
        // Ajustar el zoom para mostrar toda la ruta con un pequeño margen
        const bounds = route.getBounds().pad(0.1);
        map.fitBounds(bounds);
      } catch (err) {
        console.error('Error al dibujar la ruta:', err);
        // En caso de error al dibujar la ruta, mostrar línea recta
        drawStraightLine(map, latLngs);
      }
    } else if (latLngs.length > 1) {
      console.log('Mostrando línea recta entre puntos');
      drawStraightLine(map, latLngs);
    }

    // Agregar marcadores para inicio y fin
    if (latLngs.length > 0) {
      // Marcador de inicio (verde)
      const startIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: #22c55e; 
          width: 20px; 
          height: 20px; 
          border-radius: 50%; 
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      L.marker(latLngs[0], { icon: startIcon })
        .addTo(map)
        .bindPopup("Punto de inicio");

      // Solo mostrar marcador de fin si hay más de un punto
      if (latLngs.length > 1) {
        // Marcador de fin (rojo)
        const endIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: #ef4444; 
            width: 20px; 
            height: 20px; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        L.marker(latLngs[latLngs.length - 1], { icon: endIcon })
          .addTo(map)
          .bindPopup("Punto final");
      }
    }

    console.log("Mapa de ruta inicializado correctamente");

    // Cleanup function
    return () => {
      map.remove();
    };
  }, [routePoints]);

  if (routePoints.length === 0) {
    return (
      <div className={`w-full h-[400px] rounded-lg shadow-lg flex flex-col items-center justify-center bg-gray-50 ${className}`}>
        <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        <p className="text-gray-500 text-center">Agrega puntos de inicio y destino<br/>para ver la ruta</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            Cargando ruta...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-2 right-2 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded z-10 text-sm max-w-xs shadow-lg" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="font-medium">Atención</p>
              <p className="mt-1">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-4 -mx-1.5 -my-1.5 text-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-400 p-1.5 hover:bg-yellow-200 inline-flex h-8 w-8"
              aria-label="Cerrar"
            >
              <span className="sr-only">Cerrar</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full h-[400px] rounded-lg shadow-lg"
      />
    </div>
  );
};

export default RouteMap;
