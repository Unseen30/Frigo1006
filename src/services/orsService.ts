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

  // Convertir puntos al formato que espera ORS
  const coordinates = points.map(point => [
    point.longitude,
    point.latitude
  ]);

  const body = {
    coordinates,
    alternative_routes: {
      target_count: 1,
      weight_factor: 1.3
    },
    elevation: false,
    instructions: false,
    preference: 'recommended',
    units: 'km'
  };

  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          'Authorization': import.meta.env.VITE_ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error al obtener la ruta');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en getRoute:', error);
    throw error;
  }
};
