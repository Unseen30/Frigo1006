import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_ACCESS_TOKEN, mapboxConfig, routeStyles, markerStyles, mapboxUtils } from '@/utils/mapbox';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Route, Clock, Gauge } from 'lucide-react';

// Configurar el token de acceso de Mapbox
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp?: string;
  accuracy?: number;
  speed?: number;
}

interface MapboxRouteViewerProps {
  routePoints: RoutePoint[];
  currentPosition?: { lat: number; lng: number } | null;
  className?: string;
  showControls?: boolean;
  showStats?: boolean;
  routeType?: 'active' | 'completed' | 'planned';
  onPointClick?: (point: RoutePoint, index: number) => void;
}

const MapboxRouteViewer: React.FC<MapboxRouteViewerProps> = ({
  routePoints = [],
  currentPosition = null,
  className = '',
  showControls = true,
  showStats = true,
  routeType = 'completed',
  onPointClick
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [followRoute, setFollowRoute] = useState(false);
  const [routeStats, setRouteStats] = useState({
    totalDistance: 0,
    duration: 0,
    averageSpeed: 0,
    maxSpeed: 0
  });

  // Inicializar el mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: showSatellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : mapboxConfig.styleURL,
      center: mapboxConfig.center,
      zoom: mapboxConfig.defaultZoom,
      pitch: mapboxConfig.pitch,
      bearing: mapboxConfig.bearing,
      maxBounds: mapboxConfig.bounds,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Cambiar estilo del mapa
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const newStyle = showSatellite 
      ? 'mapbox://styles/mapbox/satellite-streets-v12' 
      : mapboxConfig.styleURL;
    
    map.current.setStyle(newStyle);
  }, [showSatellite, isLoaded]);

  // Calcular estadísticas de la ruta
  const calculateRouteStats = useCallback((points: RoutePoint[]) => {
    if (points.length < 2) {
      setRouteStats({ totalDistance: 0, duration: 0, averageSpeed: 0, maxSpeed: 0 });
      return;
    }

    const totalDistance = mapboxUtils.calculateTotalDistance(points);
    
    let duration = 0;
    let maxSpeed = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    if (points[0].timestamp && points[points.length - 1].timestamp) {
      const startTime = new Date(points[0].timestamp).getTime();
      const endTime = new Date(points[points.length - 1].timestamp).getTime();
      duration = (endTime - startTime) / 1000; // en segundos
    }

    points.forEach(point => {
      if (point.speed !== undefined) {
        maxSpeed = Math.max(maxSpeed, point.speed);
        totalSpeed += point.speed;
        speedCount++;
      }
    });

    const averageSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

    setRouteStats({
      totalDistance: Math.round(totalDistance),
      duration: Math.round(duration),
      averageSpeed: Math.round(averageSpeed * 3.6), // convertir m/s a km/h
      maxSpeed: Math.round(maxSpeed * 3.6) // convertir m/s a km/h
    });
  }, []);

  // Actualizar la ruta en el mapa
  useEffect(() => {
    if (!map.current || !isLoaded || routePoints.length === 0) return;

    // Calcular estadísticas
    calculateRouteStats(routePoints);

    // Limpiar capas existentes
    if (map.current.getSource('route')) {
      map.current.removeLayer('route-line');
      map.current.removeSource('route');
    }

    // Limpiar marcadores existentes
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Crear datos GeoJSON para la ruta
    const routeGeoJSON = mapboxUtils.pointsToGeoJSON(routePoints);

    // Agregar la fuente de datos de la ruta
    map.current.addSource('route', {
      type: 'geojson',
      data: routeGeoJSON
    });

    // Obtener estilos según el tipo de ruta
    const style = routeStyles[routeType];

    // Agregar la capa de línea de la ruta
    const paintConfig: any = {
      'line-color': style.color,
      'line-width': style.width,
      'line-opacity': style.opacity,
    };

    // Agregar dash array si existe
    if ('dashArray' in style && style.dashArray) {
      paintConfig['line-dasharray'] = style.dashArray;
    }

    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: paintConfig
    });

    // Agregar marcadores
    if (routePoints.length > 0) {
      // Marcador de inicio
      const startMarker = new mapboxgl.Marker({
        color: markerStyles.start.color,
        scale: markerStyles.start.size / 10
      })
        .setLngLat([routePoints[0].longitude, routePoints[0].latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div class="p-2">
            <h3 class="font-semibold text-green-600">Punto de Inicio</h3>
            <p class="text-sm">${mapboxUtils.formatCoordinates(routePoints[0].latitude, routePoints[0].longitude)}</p>
            ${routePoints[0].timestamp ? `<p class="text-xs text-gray-500">${new Date(routePoints[0].timestamp).toLocaleString()}</p>` : ''}
          </div>
        `))
        .addTo(map.current);

      // Marcador de fin (si hay más de un punto)
      if (routePoints.length > 1) {
        const endPoint = routePoints[routePoints.length - 1];
        const endMarker = new mapboxgl.Marker({
          color: markerStyles.end.color,
          scale: markerStyles.end.size / 10
        })
          .setLngLat([endPoint.longitude, endPoint.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-semibold text-red-600">Punto Final</h3>
              <p class="text-sm">${mapboxUtils.formatCoordinates(endPoint.latitude, endPoint.longitude)}</p>
              ${endPoint.timestamp ? `<p class="text-xs text-gray-500">${new Date(endPoint.timestamp).toLocaleString()}</p>` : ''}
            </div>
          `))
          .addTo(map.current);
      }
    }

    // Agregar marcador de posición actual si está disponible
    if (currentPosition) {
      const currentMarker = new mapboxgl.Marker({
        color: markerStyles.current.color,
        scale: markerStyles.current.size / 10
      })
        .setLngLat([currentPosition.lng, currentPosition.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div class="p-2">
            <h3 class="font-semibold text-blue-600">Posición Actual</h3>
            <p class="text-sm">${mapboxUtils.formatCoordinates(currentPosition.lat, currentPosition.lng)}</p>
          </div>
        `))
        .addTo(map.current);
    }

    // Ajustar la vista para mostrar toda la ruta
    const bounds = mapboxUtils.calculateBounds(routePoints);
    if (bounds && !followRoute) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16
      });
    }

    // Agregar evento de click en la ruta
    if (onPointClick) {
      map.current.on('click', 'route-line', (e) => {
        if (e.features && e.features[0]) {
          const coordinates = e.lngLat;
          // Encontrar el punto más cercano
          let closestIndex = 0;
          let minDistance = Infinity;
          
          routePoints.forEach((point, index) => {
            const distance = mapboxUtils.calculateDistance(
              { latitude: coordinates.lat, longitude: coordinates.lng },
              point
            );
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = index;
            }
          });
          
          onPointClick(routePoints[closestIndex], closestIndex);
        }
      });

      // Cambiar cursor al pasar sobre la ruta
      map.current.on('mouseenter', 'route-line', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'route-line', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }

  }, [isLoaded, routePoints, currentPosition, routeType, followRoute, onPointClick, calculateRouteStats]);

  // Seguir la ruta automáticamente
  useEffect(() => {
    if (!map.current || !followRoute || !currentPosition) return;

    map.current.easeTo({
      center: [currentPosition.lng, currentPosition.lat],
      zoom: 16,
      duration: 1000
    });
  }, [currentPosition, followRoute]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  if (routePoints.length === 0) {
    return (
      <div className={`w-full h-[400px] rounded-lg shadow-lg flex flex-col items-center justify-center bg-gray-50 ${className}`}>
        <MapPin className="w-12 h-12 text-gray-300 mb-2" />
        <p className="text-gray-500 text-center">
          No hay puntos de ruta disponibles
          <br />
          <span className="text-sm">Inicia un viaje para ver el recorrido</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Estadísticas de la ruta */}
      {showStats && (
        <Card className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Route className="w-4 h-4" />
              Estadísticas del Recorrido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3 h-3" />
              <span>{formatDistance(routeStats.totalDistance)}</span>
            </div>
            {routeStats.duration > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(routeStats.duration)}</span>
              </div>
            )}
            {routeStats.averageSpeed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="w-3 h-3" />
                <span>{routeStats.averageSpeed} km/h promedio</span>
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {routePoints.length} puntos
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Controles del mapa */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <Button
            variant={showSatellite ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSatellite(!showSatellite)}
            className="bg-white/90 backdrop-blur-sm"
          >
            {showSatellite ? "Calles" : "Satélite"}
          </Button>
          {currentPosition && (
            <Button
              variant={followRoute ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowRoute(!followRoute)}
              className="bg-white/90 backdrop-blur-sm"
            >
              {followRoute ? "Detener" : "Seguir"}
            </Button>
          )}
        </div>
      )}

      {/* Contenedor del mapa */}
      <div
        ref={mapContainer}
        className="w-full h-[400px] rounded-lg shadow-lg"
      />

      {/* Indicador de carga */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-lg">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Cargando mapa...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxRouteViewer;
