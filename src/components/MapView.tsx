
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader } from '@googlemaps/js-api-loader';

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
      // Primero verificamos si el navegador soporta la API de permisos
      if (!navigator.permissions || !navigator.permissions.query) {
        console.log('La API de Permissions no es soportada en este navegador');
        // Intentamos obtener la ubicación directamente
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
              console.error('Error al obtener ubicación:', error);
              toast.error('No se pudo acceder a la ubicación. Por favor, verifica los permisos.');
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      }

      // Si la API de permisos está disponible, la usamos
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setLocationPermission(result.state);

      // Manejamos los diferentes estados del permiso
      if (result.state === 'granted') {
        return true;
      }

      if (result.state === 'denied') {
        toast.error('Se requiere acceso a la ubicación. Por favor, habilita los permisos en la configuración de tu navegador.');
        return false;
      }

      // Si el estado es 'prompt', solicitamos la ubicación directamente
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setLocationPermission('granted');
            resolve(true);
          },
          (error) => {
            console.error('Error al obtener ubicación:', error);
            toast.error('No se pudo acceder a la ubicación. Por favor, verifica los permisos.');
            setLocationPermission('denied');
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    } catch (error) {
      console.error('Error al verificar permisos de ubicación:', error);
      toast.error('Error al verificar los permisos de ubicación');
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

  // Función para obtener la ruta de calles entre puntos
  const getRoute = useCallback(async (waypoints: Array<{lat: number, lng: number}>) => {
    try {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        version: 'weekly',
      });

      const google = await loader.load();
      const directionsService = new google.maps.DirectionsService();
      
      // Crear waypoints intermedios (todos los puntos excepto el primero y el último)
      const waypointsList = waypoints.slice(1, -1).map(point => ({
        location: { lat: point.lat, lng: point.lng },
        stopover: true
      }));

      const request = {
        origin: { lat: waypoints[0].lat, lng: waypoints[0].lng },
        destination: { lat: waypoints[waypoints.length - 1].lat, lng: waypoints[waypoints.length - 1].lng },
        waypoints: waypointsList,
        travelMode: google.maps.TravelMode.DRIVING,
      };

      return new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            reject(new Error('Error al obtener la ruta'));
          }
        });
      });
    } catch (error) {
      console.error('Error al cargar la API de Google Maps:', error);
      return null;
    }
  }, []);

  // Actualizar la ruta cuando cambian los puntos
  useEffect(() => {
    if (!map || routePoints.length < 2) return;

    // Convertir puntos a formato para la API
    const waypoints = routePoints.map(point => ({
      lat: point.latitude,
      lng: point.longitude
    }));

    // Obtener la ruta por calles
    getRoute(waypoints)
      .then(route => {
        if (!route) return;
        
        // Decodificar la polilínea de la ruta
        const path = route.routes[0].overview_path.map(p => ({
          lat: p.lat(),
          lng: p.lng()
        }));

        // Convertir a formato Leaflet
        const latLngs = path.map(point => L.latLng(point.lat, point.lng));

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
      })
      .catch(error => {
        console.error('Error al trazar la ruta:', error);
        // En caso de error, mostrar ruta en línea recta
        const latLngs = routePoints.map(point => 
          L.latLng(point.latitude, point.longitude)
        );
        
        if (routeLayer) {
          routeLayer.setLatLngs(latLngs);
        } else {
          const newRouteLayer = L.polyline(latLngs, {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.7,
            lineJoin: 'round',
          }).addTo(map);
          setRouteLayer(newRouteLayer);
        }
      });
  }, [map, routePoints]);

  // Función para actualizar la posición en el mapa
  const updateMapPosition = useCallback((pos: { lat: number; lng: number }) => {
    if (!map) return;
    
    const newLatLng = L.latLng(pos.lat, pos.lng);
    
    // Actualizar o crear el marcador de posición actual
    if (marker) {
      marker.setLatLng(newLatLng);
    } else {
      const newMarker = L.marker(newLatLng, {
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

    // Centrar el mapa en la posición actual
    map.setView(newLatLng, 17);
  }, [map, marker]);

  // Efecto para manejar la posición actual
  useEffect(() => {
    if (!map) return;

    // Si no hay posición actual, intentar obtenerla
    if (!currentPosition) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            updateMapPosition(pos);
          },
          (error) => {
            console.error('Error al obtener la ubicación:', error);
            toast.error('No se pudo obtener la ubicación actual');
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
      return;
    }
    
    // Si tenemos una posición actual, actualizar el mapa
    updateMapPosition(currentPosition);
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
