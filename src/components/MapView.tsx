
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
}

interface MapViewProps {
  className?: string;
  routePoints?: RoutePoint[];
  currentPosition?: { lat: number; lng: number } | null;
}

const MapView = ({ 
  className = "", 
  routePoints = [], 
  currentPosition = null 
}: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);
  const [marker, setMarker] = useState<L.Marker | null>(null);

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

  // Inicializar el mapa
  useEffect(() => {
    if (!mapRef.current || map) return;

    const newMap = L.map(mapRef.current, {
      center: URUGUAY_CENTER,
      zoom: 15,
      minZoom: 6,
      maxZoom: 19,
      maxBounds: [
        [-34.973436, -58.442722], // Southwest coordinates
        [-30.082224, -53.073925]  // Northeast coordinates
      ],
      maxBoundsViscosity: 1.0
    });

    // Estilo de mapa con calles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(newMap);

    setMap(newMap);

    return () => {
      if (routeLayer) {
        newMap.removeLayer(routeLayer);
      }
      if (marker) {
        newMap.removeLayer(marker);
      }
      newMap.remove();
    };
  }, []);

  // Actualizar la ruta cuando cambian los puntos
  useEffect(() => {
    if (!map || routePoints.length === 0) return;

    // Convertir puntos a formato Leaflet
    const latLngs = routePoints.map(point => 
      L.latLng(point.latitude, point.longitude)
    );

    // Si ya existe una capa de ruta, actualizarla
    if (routeLayer) {
      routeLayer.setLatLngs(latLngs);
    } else {
      // Crear nueva capa de ruta
      const newRouteLayer = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.7,
        lineJoin: 'round',
      }).addTo(map);
      
      setRouteLayer(newRouteLayer);
      
      // Ajustar la vista para que se vea toda la ruta
      if (latLngs.length > 0) {
        map.fitBounds(newRouteLayer.getBounds(), {
          padding: [50, 50],
          maxZoom: 17,
        });
      }
    }
  }, [map, routePoints]);

  // Actualizar la posición actual en el mapa
  useEffect(() => {
    if (!map || !currentPosition) return;

    const { lat, lng } = currentPosition;
    const position = L.latLng(lat, lng);

    // Actualizar o crear el marcador de posición actual
    if (marker) {
      marker.setLatLng(position);
    } else {
      const newMarker = L.marker(position, {
        icon: L.divIcon({
          className: 'current-location-marker',
          iconSize: [24, 24],
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: #3b82f6;
              border: 2px solid white;
              border-radius: 50%;
              transform: translate(-12px, -12px);
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `
        })
      }).addTo(map);
      
      setMarker(newMarker);
    }
    
    // Centrar el mapa en la posición actual si es el primer punto
    if (routePoints.length <= 1) {
      map.setView(position, 17);
    }
  }, [map, currentPosition]);

  // Estilo CSS para el marcador de posición actual
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .current-location-marker {
        background: none !important;
        border: none !important;
      }
      .current-location-marker::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Solicitar permisos de ubicación al montar
  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <div
      ref={mapRef}
      className={`w-full h-[400px] rounded-lg shadow-lg ${className}`}
    />
  );
};

export default MapView;
