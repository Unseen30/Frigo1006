import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import axios from 'axios';
// No necesitamos importar bibliotecas adicionales

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
console.log('Cargando variables de entorno desde:', envPath);
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const openRouteApiKey = process.env.OPENROUTE_API_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  console.log('Asegúrate de tener un archivo .env con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
  process.exit(1);
}

if (!openRouteApiKey) {
  console.error('Error: Falta la clave de API de OpenRouteService.');
  console.log('Por favor, agrega tu clave de API de OpenRouteService al archivo .env:');
  console.log('OPENROUTE_API_KEY=tu_clave_openroute');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Coordenadas de ejemplo (Montevideo a Canelones)
const START_POINT = {
  lat: -34.9011,  // Montevideo
  lng: -56.1645
};

// Función para obtener una ruta realista usando OpenRouteService
async function getRoute(originCoords: [number, number], destCoords: [number, number]) {
  try {
    const apiKey = process.env.OPENROUTE_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTE_API_KEY no está configurada en el archivo .env');
    }

    // Validar coordenadas
    if (!originCoords || !destCoords || 
        !Array.isArray(originCoords) || originCoords.length !== 2 ||
        !Array.isArray(destCoords) || destCoords.length !== 2) {
      throw new Error('Coordenadas de origen o destino no válidas o en formato incorrecto');
    }
    
    // Validar rango de coordenadas (lng: -180 a 180, lat: -90 a 90)
    const [startLng, startLat] = originCoords;
    const [endLng, endLat] = destCoords;
    
    if (isNaN(startLng) || isNaN(startLat) || isNaN(endLng) || isNaN(endLat) ||
        startLng < -180 || startLng > 180 || startLat < -90 || startLat > 90 ||
        endLng < -180 || endLng > 180 || endLat < -90 || endLat > 90) {
      throw new Error(`Coordenadas fuera de rango: origen=[${startLng}, ${startLat}], destino=[${endLng}, ${endLat}]`);
    }
    
    // Hacer la solicitud a la API de OpenRouteService con manejo de errores
    let response;
    try {
      console.log(`Solicitando ruta de ${originCoords} a ${destCoords}...`);
      
      response = await axios.get(
        `https://api.openrouteservice.org/v2/directions/driving-car`,
        {
          params: {
            api_key: apiKey,
            start: `${originCoords[0]},${originCoords[1]}`,
            end: `${destCoords[0]},${destCoords[1]}`
          },
          timeout: 30000 // 30 segundos de timeout
        }
      );
      
      if (!response.data?.features?.[0]?.properties?.segments?.[0]?.distance) {
        throw new Error('La respuesta de la API no contiene la información de ruta esperada');
      }
      
      console.log(`Ruta obtenida: ${(response.data.features[0].properties.segments[0].distance / 1000).toFixed(1)} km`);
    } catch (error: any) {
      console.error('Error al obtener la ruta de OpenRouteService:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`No se pudo obtener la ruta: ${error.response?.data?.error?.message || error.message}`);
    }

    // Extraer la geometría codificada en polyline6
    const geometry = response.data.features[0].geometry;

    // Usar directamente las coordenadas de la respuesta de la API
    // OpenRouteService devuelve las coordenadas como [lon, lat] en el formato GeoJSON
    const coordinates = geometry.coordinates || [];

    // Convertir a formato de puntos con timestamp
    const now = new Date();
    const startTime = now.getTime();
    const endTime = startTime + (60 * 60 * 1000); // 1 hora de duración

    return coordinates.map((point, index, array) => {
      const ratio = array.length > 1 ? index / (array.length - 1) : 0;
      const timestamp = new Date(startTime + (endTime - startTime) * ratio).toISOString();

      // OpenRouteService devuelve [lon, lat], necesitamos [lat, lon] para nuestra aplicación
      return {
        latitude: point[1], // latitud
        longitude: point[0], // longitud
        timestamp
      };
    });
  } catch (error) {
    console.error('Error al obtener la ruta de OpenRouteService:', error.response?.data || error.message);
    throw error;
  }
}

// Función principal
async function simulateRealisticRoute(tripId: string) {
  try {
    console.log(`Generando ruta realista para el viaje ${tripId}...`);

    // Obtener información del viaje con las coordenadas
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error(`No se encontró el viaje con ID ${tripId}: ${tripError?.message || 'Viaje no encontrado'}`);
    }

    // Obtener las rutas de prueba con coordenadas predefinidas
    const testRoutes = [
      {
        origin: 'Montevideo',
        originCoords: [-56.1645, -34.9011], // [lng, lat]
        destination: 'Punta del Este',
        destCoords: [-54.9393, -34.9606]
      },
      {
        origin: 'Colonia',
        originCoords: [-57.8444, -34.4735],
        destination: 'Paysandú',
        destCoords: [-58.0756, -32.3214]
      },
      {
        origin: 'Salto',
        originCoords: [-57.9614, -31.3959],
        destination: 'Melo',
        destCoords: [-54.1838, -32.3668]
      },
      {
        origin: 'Rivera',
        originCoords: [-55.5508, -30.9022],
        destination: 'Rocha',
        destCoords: [-54.3333, -34.4833]
      }
    ];
    
    // Buscar la ruta que coincida con el viaje actual
    const route = testRoutes.find(r => 
      trip.origin.includes(r.origin) || 
      trip.destination.includes(r.destination)
    );
    
    if (!route) {
      throw new Error(`No se encontró una ruta predefinida para el viaje ${trip.origin} → ${trip.destination}`);
    }
    
    const originCoords = route.originCoords as [number, number];
    const destCoords = route.destCoords as [number, number];
    
    console.log(`Usando coordenadas predefinidas para la ruta: ${route.origin} → ${route.destination}`);

    // Generar la ruta con las coordenadas obtenidas
    const routePoints = await getRoute(originCoords, destCoords);

    console.log(`Se generaron ${routePoints.length} puntos de ruta`);

    // Preparar datos para insertar
    const pointsToInsert = routePoints.map(point => ({
      trip_id: tripId,
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: point.timestamp
    }));

    console.log('Insertando puntos en la base de datos...');

    // Insertar en lotes de 10 para evitar sobrecargar la API
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < pointsToInsert.length; i += batchSize) {
      const batch = pointsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('route_points')
        .insert(batch as any[]);

      if (error) {
        console.error('Error al insertar lote de puntos:', error);
      } else {
        insertedCount += batch.length;
        console.log(`Insertados ${insertedCount}/${pointsToInsert.length} puntos...`);
      }
    }

    console.log(`✅ Se insertaron ${insertedCount} puntos de ruta para el viaje ${tripId}`);

    // Actualizar el estado del viaje a "completed"
    const { error: updateError } = await supabase
      .from('trips')
      .update({ status: 'completed' })
      .eq('id', tripId);

    if (updateError) {
      console.error('Error al actualizar el estado del viaje:', updateError);
    } else {
      console.log('✅ Estado del viaje actualizado a "completed"');
    }

    return insertedCount;
  } catch (error) {
    console.error('❌ Error en la simulación de ruta:', error);
    throw error;
  }
}

// Ejecutar el script
const tripId = process.argv[2];

if (!tripId) {
  console.log('Uso: npx tsx scripts/simulateRealisticRoute.ts <trip_id>');
  console.log('Ejemplo: npx tsx scripts/simulateRealisticRoute.ts 1d17b5f8-5392-456d-a3fe-0fb10d2a558f');
  process.exit(1);
}

simulateRealisticRoute(tripId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
