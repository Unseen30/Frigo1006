
import { useEffect, useRef } from "react";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RouteMapProps {
  className?: string;
  routePoints?: { latitude: number; longitude: number }[];
}

const RouteMap = ({ className = "", routePoints = [] }: RouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  // Fix para los marcadores por defecto de Leaflet
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  useEffect(() => {
    if (mapRef.current && routePoints.length > 0) {
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

      // Crear la polilínea de la ruta
      const polyline = L.polyline(latLngs, {
        color: '#FF0000',
        weight: 3,
        opacity: 1.0
      }).addTo(map);

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

      // Ajustar vista para mostrar toda la ruta
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      console.log("Mapa de ruta inicializado correctamente");

      // Cleanup function
      return () => {
        map.remove();
      };
    }
  }, [routePoints]);

  if (routePoints.length === 0) {
    return (
      <div className={`w-full h-[400px] rounded-lg shadow-lg flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-gray-600">No hay puntos de ruta disponibles</div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`w-full h-[400px] rounded-lg shadow-lg ${className}`}
    />
  );
};

export default RouteMap;
