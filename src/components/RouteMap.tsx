
import { useEffect, useRef, useState } from "react";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRoute } from "@/services/orsService";

interface RouteMapProps {
  className?: string;
  routePoints?: { latitude: number; longitude: number }[];
}

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
      if (routePoints.length < 2) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getRoute(routePoints);
        setRouteData(data);
      } catch (err) {
        console.error('Error al obtener la ruta:', err);
        setError('No se pudo cargar la ruta. Mostrando línea recta entre puntos.');
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
      const route = L.geoJSON(routeData.features[0].geometry, {
        style: {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8
        }
      }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [50, 50] });
    } else if (latLngs.length > 1) {
      // Mostrar línea recta si no hay datos de ruta
      const polyline = L.polyline(latLngs, {
        color: '#9ca3af',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5'
      }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
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
      <div className={`w-full h-[400px] rounded-lg shadow-lg flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-gray-600">No hay puntos de ruta disponibles</div>
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
        <div className="absolute top-2 right-2 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded z-10 text-sm">
          {error}
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
