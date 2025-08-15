export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export const mapboxConfig = {
  styleURL: 'mapbox://styles/mapbox/streets-v12',
  defaultZoom: 14,
  minZoom: 5,
  maxZoom: 20,
  pitch: 45,
  bearing: 0,
  // Configuración específica para Uruguay
  center: [-56.0201525, -32.8755548] as [number, number],
  bounds: [
    [-58.442722, -34.973436], // Southwest coordinates
    [-53.073925, -30.082224]  // Northeast coordinates
  ] as [[number, number], [number, number]],
};

// Configuración de estilos para las rutas
export const routeStyles = {
  active: {
    color: '#3b82f6',
    width: 6,
    opacity: 0.8,
  },
  completed: {
    color: '#22c55e',
    width: 5,
    opacity: 0.7,
  },
  planned: {
    color: '#6b7280',
    width: 4,
    opacity: 0.6,
    dashArray: [5, 5] as [number, number],
  },
};

// Configuración de marcadores
export const markerStyles = {
  start: {
    color: '#22c55e',
    size: 12,
  },
  end: {
    color: '#ef4444',
    size: 12,
  },
  current: {
    color: '#3b82f6',
    size: 14,
    pulse: true,
  },
  waypoint: {
    color: '#f59e0b',
    size: 8,
  },
};

// Utilidades para trabajar con coordenadas
export const mapboxUtils = {
  // Convertir puntos de ruta a formato GeoJSON
  pointsToGeoJSON: (points: Array<{ latitude: number; longitude: number; timestamp?: string }>) => {
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: points.map(point => [point.longitude, point.latitude])
        }
      }]
    };
  },

  // Calcular bounds para un conjunto de puntos
  calculateBounds: (points: Array<{ latitude: number; longitude: number }>) => {
    if (points.length === 0) return null;
    
    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;
    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;

    points.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    return [
      [minLng, minLat],
      [maxLng, maxLat]
    ] as [[number, number], [number, number]];
  },

  // Formatear coordenadas para display
  formatCoordinates: (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  },

  // Calcular distancia entre dos puntos (en metros)
  calculateDistance: (point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }) => {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = point1.latitude * Math.PI/180;
    const φ2 = point2.latitude * Math.PI/180;
    const Δφ = (point2.latitude-point1.latitude) * Math.PI/180;
    const Δλ = (point2.longitude-point1.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  },

  // Calcular distancia total de una ruta
  calculateTotalDistance: (points: Array<{ latitude: number; longitude: number }>) => {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += mapboxUtils.calculateDistance(points[i-1], points[i]);
    }
    
    return totalDistance;
  },
};
