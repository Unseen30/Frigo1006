/**
 * Servicio para interactuar con la API de OpenRouteService
 */

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Obtiene la ruta entre múltiples puntos usando OpenRouteService
 */
export const getRoute = async (points: Coordinate[]) => {
  if (points.length < 2) {
    throw new Error('Se requieren al menos 2 puntos para calcular una ruta');
  }

  // Tomar solo el primer y último punto para la ruta
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  
  // Convertir puntos al formato que espera ORS [longitud, latitud]
  const coordinates = [
    [startPoint.longitude, startPoint.latitude],
    [endPoint.longitude, endPoint.latitude]
  ];

  try {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) {
      throw new Error('No se encontró la clave API de OpenRouteService');
    }

    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates,
          elevation: false,
          instructions: false,
          preference: 'recommended',
          units: 'km',
          geometry_simplify: true,
          options: {
            avoid_features: ['ferries', 'highways', 'tollways']
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from ORS:', errorText);
      throw new Error('Error al obtener la ruta del servidor');
    }

    const data = await response.json();
    
    if (!data || !data.features || data.features.length === 0) {
      throw new Error('No se pudo calcular la ruta con los puntos proporcionados');
    }

    return data;
  } catch (error) {
    console.error('Error en getRoute:', error);
    throw new Error('No se pudo conectar con el servicio de rutas. Mostrando línea recta entre puntos.');
  }
};

/**
 * Obtiene la ruta detallada entre múltiples puntos
 */
export const getDetailedRoute = async (points: Coordinate[]) => {
  if (points.length < 2) {
    throw new Error('Se requieren al menos 2 puntos para calcular una ruta');
  }

  // Convertir puntos al formato [longitud, latitud]
  const coordinates = points.map(point => [point.longitude, point.latitude]);
  
  // Si hay muchos puntos, tomamos una muestra representativa
  let sampledCoordinates = coordinates;
  const MAX_POINTS = 25; // Límite de puntos para la API
  
  if (coordinates.length > MAX_POINTS) {
    const step = Math.ceil(coordinates.length / MAX_POINTS);
    sampledCoordinates = [];
    for (let i = 0; i < coordinates.length; i += step) {
      sampledCoordinates.push(coordinates[i]);
    }
    // Asegurarse de incluir el último punto
      sampledCoordinates.push(coordinates[coordinates.length - 1]);
  }

  try {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) {
      throw new Error('No se encontró la clave API de OpenRouteService');
    }

    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: sampledCoordinates,
          elevation: false,
          instructions: false,
          preference: 'recommended',
          units: 'km',
          geometry_simplify: true,
          options: {
            avoid_features: ['ferries']
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from ORS:', errorText);
      return null; // Devolver null para que el componente maneje el fallo
    }

    const data = await response.json();
    
    if (!data || !data.features || data.features.length === 0) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error en getDetailedRoute:', error);
    return null; // Devolver null para que el componente maneje el fallo
  }
};
