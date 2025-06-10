
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  className?: string;
}

const MapView = ({ className = "" }: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  // Coordenadas centrales de Uruguay (aproximadamente)
  const URUGUAY_CENTER: [number, number] = [-32.8755548, -56.0201525];

  // Fix para los marcadores por defecto de Leaflet
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const requestLocationPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setLocationPermission(result.state);

      if (result.state === 'denied') {
        toast.error("Se requiere acceso a la ubicación para un mejor funcionamiento");
        return false;
      }

      if (result.state === 'prompt') {
        toast("Por favor, permite el acceso a tu ubicación para un mejor funcionamiento");
      }

      return true;
    } catch (error) {
      console.error("Error checking permissions:", error);
      return false;
    }
  };

  useEffect(() => {
    const initializeMap = async () => {
      if (!mapRef.current) return;

      const hasPermission = await requestLocationPermission();
      
      try {
        console.log("Inicializando mapa con Leaflet...");
        
        // Crear el mapa con OpenStreetMap
        const leafletMap = L.map(mapRef.current, {
          center: URUGUAY_CENTER,
          zoom: 7,
          minZoom: 6,
          maxZoom: 18,
          maxBounds: [
            [-34.973436, -58.442722], // Southwest coordinates
            [-30.082224, -53.073925]  // Northeast coordinates
          ],
          maxBoundsViscosity: 1.0
        });

        // Agregar capa de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(leafletMap);

        console.log("Mapa inicializado correctamente");
        setMap(leafletMap);

        if (hasPermission && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLocation: [number, number] = [
                position.coords.latitude,
                position.coords.longitude,
              ];
              
              leafletMap.setView(userLocation, 15);
              
              // Agregar marcador de ubicación actual
              L.marker(userLocation)
                .addTo(leafletMap)
                .bindPopup("Tu ubicación")
                .openPopup();
            },
            () => {
              console.error("Error: No se pudo obtener la ubicación.");
              toast.error("No se pudo obtener tu ubicación");
            }
          );
        }
      } catch (error) {
        console.error("Error loading map:", error);
        toast.error("Error al cargar el mapa");
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      className={`w-full h-[400px] rounded-lg shadow-lg ${className}`}
    />
  );
};

export default MapView;
