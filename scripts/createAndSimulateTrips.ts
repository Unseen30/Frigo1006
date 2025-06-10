import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import axios from 'axios';

// Configuración para CommonJS
const __filename = fileURLToPath(import.meta?.url || '');
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
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

// Función para obtener una ruta realista usando OpenRouteService
async function getRoute(originCoords: [number, number], destCoords: [number, number]) {
  try {
    console.log(`Solicitando ruta de ${originCoords} a ${destCoords}...`);
    
    const response = await axios.get(
      `https://api.openrouteservice.org/v2/directions/driving-car`,
      {
        params: {
          api_key: openRouteApiKey,
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

    // Extraer la geometría de la respuesta
    const coordinates = response.data.features[0].geometry.coordinates || [];

    // Convertir a formato de puntos con timestamp
    const now = new Date();
    const startTime = now.getTime();
    const endTime = startTime + (60 * 60 * 1000); // 1 hora de duración

    return coordinates.map((point, index, array) => {
      const ratio = array.length > 1 ? index / (array.length - 1) : 0;
      const timestamp = new Date(startTime + (endTime - startTime) * ratio).toISOString();

      return {
        latitude: point[1], // latitud
        longitude: point[0], // longitud
        timestamp
      };
    });
  } catch (error: any) {
    console.error('Error al obtener la ruta de OpenRouteService:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Función para crear un viaje de prueba
async function createTestTrip(driverId: string, truckId: string, route: any) {
  try {
    const startTime = new Date();
    const endTime = new Date();
    
    // Añadir un tiempo aleatorio en las últimas 2 semanas
    startTime.setDate(startTime.getDate() - Math.floor(Math.random() * 14));
    
    // El viaje dura entre 1 y 8 horas
    const durationHours = 1 + Math.floor(Math.random() * 7);
    endTime.setTime(startTime.getTime() + (durationHours * 60 * 60 * 1000));
    
    // Crear el viaje en la base de datos
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        driver_id: driverId,
        truck_id: truckId,
        origin: route.origin,
        destination: route.destination,
        cargo_description: route.cargo,
        cargo_weight: route.weight,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'completed',
        distance: route.distance
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✅ Viaje creado: ${route.origin} → ${route.destination} (ID: ${trip.id})`);
    
    return {
      ...trip,
      originCoords: route.originCoords,
      destCoords: route.destCoords
    };
  } catch (error) {
    console.error('Error al crear el viaje:', error);
    throw error;
  }
}

// Función para simular una ruta para un viaje
async function simulateRouteForTrip(tripId: string, originCoords: [number, number], destCoords: [number, number]) {
  try {
    console.log(`Generando ruta realista para el viaje ${tripId}...`);
    
    // Generar la ruta con las coordenadas proporcionadas
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
    return insertedCount;
  } catch (error) {
    console.error('Error al simular la ruta:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    console.log('Iniciando creación de viajes de prueba...');
    
    // Obtener el primer conductor disponible
    const { data: drivers, error: driverError } = await supabase
      .from('drivers')
      .select('id, name')
      .limit(1);

    if (driverError || !drivers || drivers.length === 0) {
      console.error('No se encontraron conductores en la base de datos');
      console.log('Por favor, crea al menos un conductor primero');
      return;
    }

    const driver = drivers[0];
    
    // Obtener el primer camión disponible
    const { data: trucks, error: truckError } = await supabase
      .from('trucks')
      .select('id, plate_number')
      .limit(1);

    if (truckError || !trucks || trucks.length === 0) {
      console.error('No se encontraron camiones en la base de datos');
      console.log('Por favor, crea al menos un camión primero');
      return;
    }

    const truck = trucks[0];
    
    // Definir el tipo para las coordenadas
    type Coordinate = [number, number];
    
    // Interfaz para las rutas de prueba
    interface TestRoute {
      origin: string;
      originCoords: Coordinate;
      destination: string;
      destCoords: Coordinate;
      cargo: string;
      weight: number;
      distance: number;
    }
    
    // Rutas de prueba con coordenadas predefinidas
    const testRoutes: TestRoute[] = [
      {
        origin: 'Montevideo',
        originCoords: [-56.1645, -34.9011] as Coordinate, // [lng, lat]
        destination: 'Punta del Este',
        destCoords: [-54.9393, -34.9606] as Coordinate,
        cargo: 'Electrodomésticos',
        weight: 15,
        distance: 130 // km
      },
      {
        origin: 'Colonia',
        originCoords: [-57.8444, -34.4735] as Coordinate,
        destination: 'Paysandú',
        destCoords: [-58.0756, -32.3214] as Coordinate,
        cargo: 'Maquinaria agrícola',
        weight: 30,
        distance: 320 // km
      },
      {
        origin: 'Salto',
        originCoords: [-57.9614, -31.3959] as Coordinate,
        destination: 'Melo',
        destCoords: [-54.1838, -32.3668] as Coordinate,
        cargo: 'Productos electrónicos',
        weight: 20,
        distance: 380 // km
      },
      {
        origin: 'Rivera',
        originCoords: [-55.5508, -30.9022] as Coordinate,
        destination: 'Rocha',
        destCoords: [-54.3333, -34.4833] as Coordinate,
        cargo: 'Productos de limpieza',
        weight: 25,
        distance: 420 // km
      }
    ];

    // Crear y simular rutas para cada viaje
    for (const route of testRoutes) {
      try {
        console.log(`\n--- Procesando ruta: ${route.origin} → ${route.destination} ---`);
        
        // 1. Crear el viaje de prueba
        const trip = await createTestTrip(driver.id, truck.id, route);
        
        // 2. Generar y guardar la ruta realista
        await simulateRouteForTrip(trip.id, route.originCoords, route.destCoords);
        
        console.log(`✅ Ruta completada: ${route.origin} → ${route.destination}`);
      } catch (error) {
        console.error(`❌ Error al procesar la ruta ${route.origin} → ${route.destination}:`, error);
      }
    }
    
    console.log('\n✅ Proceso completado. Se crearon todas las rutas de prueba.');
  } catch (error) {
    console.error('❌ Error en el proceso principal:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
