export interface ReverseGeocodeResult {
  street?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  displayName?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Realiza una geocodificación inversa para obtener la dirección a partir de coordenadas
 * @param lat Latitud
 * @param lon Longitud
 * @returns Objeto con la información de la dirección
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<ReverseGeocodeResult> => {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=es&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error(`Error en la geocodificación: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.address) {
      throw new Error('No se encontró dirección para las coordenadas proporcionadas');
    }
    
    const { address } = data;
    
    // Mapear la respuesta de Nominatim a nuestro formato
    const result: ReverseGeocodeResult = {
      street: address.road || address.pedestrian || address.footway || address.road_reference || '',
      city: address.city || address.town || address.village || address.hamlet || address.locality || address.county || '',
      country: address.country,
      postalCode: address.postcode,
      displayName: data.display_name
    };
    
    return result;
  } catch (error) {
    console.error('Error en reverseGeocode:', error);
    throw error;
  }
};

/**
 * Obtiene el nombre de la calle a partir de coordenadas
 * @param lat Latitud
 * @param lon Longitud
 * @returns Nombre de la calle o una cadena vacía si no se pudo determinar
 */
export const getStreetName = async (lat: number, lon: number): Promise<string> => {
  try {
    const result = await reverseGeocode(lat, lon);
    return result.street || '';
  } catch (error) {
    console.error('Error al obtener el nombre de la calle:', error);
    return '';
  }
};
