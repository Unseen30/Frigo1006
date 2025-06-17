import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import nodeFetch from 'node-fetch';
// @ts-ignore - Faker tiene tipos incorrectos
import { faker } from '@faker-js/faker/locale/es';
// @ts-ignore - El tipo Database se importa correctamente
import type { Database } from '../src/integrations/supabase/types';

// Usar node-fetch en lugar de la implementación global
const fetch = nodeFetch as unknown as typeof globalThis.fetch;

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
// @ts-ignore - __dirname no está definido en módulos ES
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configuración de OpenRouteService
const ORS_API_KEY = process.env.VITE_ORS_API_KEY;
const ORS_API_URL = 'https://api.openrouteservice.org/v2';

if (!ORS_API_KEY) {
  console.error('Error: Falta la API key de OpenRouteService.');
  console.log('Asegúrate de tener en tu archivo .env:');
  console.log('VITE_ORS_API_KEY=tu_api_key_aqui');
  process.exit(1);
}

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  console.log('Asegúrate de tener un archivo .env con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
  console.log('VITE_ORS_API_URL=tu_url_de_openrouteservice');
  console.log('VITE_ORS_API_KEY=tu_clave_de_openrouteservice');
  process.exit(1);
}

// @ts-ignore - Supabase tiene problemas con los tipos genéricos
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Interfaces de tipos
interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface RoutePointDB extends RoutePoint {
  id?: string;
  trip_id: string;
  timestamp: string;
}

// Interfaz para la respuesta de OpenRouteService
interface ORSRoute {
  features: Array<{
    geometry: {
      coordinates: [number, number][];
    };
    properties: {
      summary: {
        distance: number;
        duration: number;
      };
    };
  }>;
}

interface Trip {
  id: string;
  origin: string;
  destination: string;
  start_time: string | null;
  [key: string]: any; // Para otras propiedades que no necesitamos tipar explícitamente
}

function generateRoutePoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  pointsCount: number = 20
): RoutePoint[] {
  const points: RoutePoint[] = [];
  
  // Asegurarse de que tengamos al menos 2 puntos
  pointsCount = Math.max(2, pointsCount);
  
  for (let i = 0; i < pointsCount; i++) {
    const ratio = i / (pointsCount - 1);
    // Interpolar linealmente entre los puntos de inicio y fin
    const lat = startLat + (endLat - startLat) * ratio;
    const lng = startLng + (endLng - startLng) * ratio;
    
    // Agregar un poco de variación aleatoria para hacer la ruta más realista
    const randomOffset = () => (Math.random() - 0.5) * 0.01; // Aprox. +/- 1km
    
    points.push({
      latitude: lat + randomOffset(),
      longitude: lng + randomOffset()
    });
  }
  
  return points;
}

// Función para obtener una ruta real usando OpenRouteService
async function getRoute(start: [number, number], end: [number, number], pointsCount: number = 30): Promise<RoutePoint[]> {
  try {
    console.log('Obteniendo ruta de OpenRouteService...');
    console.log(`Desde: [${start[1]}, ${start[0]}]`);
    console.log(`Hasta: [${end[1]}, ${end[0]}]`);
    
    // Construir la URL de la API de OpenRouteService con el formato correcto [lon,lat]
    const response = await fetch(
      `${ORS_API_URL}/directions/driving-car?api_key=${ORS_API_KEY}&start=${start[0]},${start[1]}&end=${end[0]},${end[1]}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/geo+json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta de OpenRouteService:', response.status, response.statusText);
      console.error('Detalles del error:', errorText);
      throw new Error(`Error en la respuesta de OpenRouteService: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No se encontraron características de ruta en la respuesta');
    }
    
    // Extraer los puntos de la ruta
    const coordinates = data.features[0].geometry.coordinates;
    
    if (!coordinates || coordinates.length < 2) {
      throw new Error('La ruta no contiene suficientes puntos');
    }

    return coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (error) {
    console.error('Error al obtener la ruta de OpenRouteService:', error);
    // En caso de error, generamos una ruta en línea recta como respaldo
    return generateRoutePoints(
      start[1],
      start[0],
      end[1],
      end[0],
      pointsCount
    );
  }
}

// Función para simular un viaje
async function simulateTrip(tripId: string) {
  try {
    console.log(`Iniciando simulación de viaje para ID: ${tripId}`);
    
    // 1. Obtener información del viaje
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single<Trip>();
    
    if (tripError || !trip) {
      console.error('Error al obtener el viaje:', tripError?.message || 'Viaje no encontrado');
      return;
    }
    
    console.log(`Viaje encontrado: ${trip.origin} → ${trip.destination}`);
    
    // 2. Generar puntos de ruta usando OpenRouteService
    // Coordenadas reales en Uruguay
    const locations = [
      { name: 'Montevideo', coords: [-56.1645, -34.9011] },
      { name: 'Punta del Este', coords: [-54.95, -34.9667] },
      { name: 'Colonia del Sacramento', coords: [-57.85, -34.4833] },
      { name: 'Paysandú', coords: [-58.0758, -32.3214] },
      { name: 'Salto', coords: [-57.9667, -31.3833] },
      { name: 'Melo', coords: [-54.1833, -32.3667] },
      { name: 'Rivera', coords: [-55.5508, -30.9053] },
      { name: 'Artigas', coords: [-56.4667, -30.4] },
      { name: 'Tacuarembó', coords: [-55.9833, -31.7333] },
      { name: 'Durazno', coords: [-56.5167, -33.3833] }
    ];
    
    // Seleccionar dos ubicaciones aleatorias diferentes
    let startIdx, endIdx;
    do {
      startIdx = Math.floor(Math.random() * locations.length);
      endIdx = Math.floor(Math.random() * locations.length);
    } while (startIdx === endIdx);
    
    const startPoint = locations[startIdx].coords as [number, number];
    const endPoint = locations[endIdx].coords as [number, number];
    
    console.log(`Ruta: ${locations[startIdx].name} → ${locations[endIdx].name}`);
    console.log('Obteniendo ruta de OpenRouteService...');
    
    // 3. Obtener la ruta de OpenRouteService
    const routePoints = await getRoute(startPoint, endPoint, 50);
    
    if (routePoints.length === 0) {
      throw new Error('No se pudieron generar puntos de ruta');
    }
    
    console.log(`Ruta obtenida con ${routePoints.length} puntos`);
    
    // 4. Actualizar el viaje con las coordenadas de inicio y fin
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        start_location: { type: 'Point', coordinates: [startPoint[0], startPoint[1]] },
        end_location: { type: 'Point', coordinates: [endPoint[0], endPoint[1]] },
        origin: locations[startIdx].name,
        destination: locations[endIdx].name,
        status: 'active' // Marcamos el viaje como activo
      })
      .eq('id', tripId);
    
    if (updateError) {
      throw new Error(`Error al actualizar el viaje: ${updateError.message}`);
    }
    
    // 5. Insertar los puntos de ruta en la base de datos
    console.log('Insertando puntos de ruta en la base de datos...');
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000); // Hace 1 hora
    
    const pointsToInsert = routePoints.map((point, index) => {
      // Distribuir los puntos a lo largo de la última hora
      const pointTime = new Date(startTime.getTime() + (index * 3600000 / routePoints.length));
      
      return {
        trip_id: tripId,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: pointTime.toISOString(),
        accuracy: 10 + Math.random() * 5, // Precisión simulada entre 10-15 metros
        speed: 20 + Math.random() * 60, // Velocidad simulada entre 20-80 km/h
        heading: Math.random() * 360 // Dirección simulada
      };
    });
    
    // Insertar en lotes para evitar sobrecargar la base de datos
    const batchSize = 50;
    for (let i = 0; i < pointsToInsert.length; i += batchSize) {
      const batch = pointsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('route_points')
        .insert(batch);
      
      if (insertError) {
        throw new Error(`Error al insertar lote de puntos de ruta: ${insertError.message}`);
      }
      
      console.log(`  Insertado lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(pointsToInsert.length / batchSize)}`);
    }
    
    console.log(`Se insertaron ${pointsToInsert.length} puntos de ruta exitosamente`);
    
    // 6. Calcular y actualizar la distancia total del viaje
    let distanceKm = 0;
    if (routePoints.length > 1) {
      for (let i = 1; i < routePoints.length; i++) {
        const p1 = routePoints[i - 1];
        const p2 = routePoints[i];
        distanceKm += calculateDistance(
          p1.latitude, 
          p1.longitude,
          p2.latitude, 
          p2.longitude
        );
      }
    }
    
    // Redondear a 2 decimales
    const roundedDistance = Math.round(distanceKm * 100) / 100;
    
    // Actualizar el viaje con la distancia y marcarlo como completado
    await supabase
      .from('trips')
      .update({ 
        distance: roundedDistance,
        status: 'completed',
        end_time: now.toISOString()
      })
      .eq('id', tripId);
    
    console.log(`Distancia del viaje: ${roundedDistance} km`);
    console.log('Viaje simulado exitosamente!');
    
  } catch (error) {
    console.error('Error en la simulación del viaje:', error);
    throw error;
  }
}

// Función para calcular la distancia entre dos puntos usando la fórmula de Haversine
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
}

// Función para crear un viaje de prueba si no se proporciona un ID
async function createTestTrip(): Promise<string | null> {
  try {
    // Obtener un conductor y un camión existentes
    // Usar una aserción de tipo más segura
    const { data: drivers } = await (supabase as unknown as { from: (table: string) => any })
      .from('drivers')
      .select('id')
      .limit(1);
    
    const { data: trucks } = await (supabase as unknown as { from: (table: string) => any })
      .from('trucks')
      .select('id')
      .limit(1);
    
    if (!drivers?.length || !trucks?.length) {
      console.error('No se encontraron conductores o camiones en la base de datos');
      return null;
    }
    
    const driverId = drivers[0].id;
    const truckId = trucks[0].id;
    
    // Crear un viaje de prueba
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        driver_id: driverId,
        truck_id: truckId,
        origin: `${faker.location.city()}, ${faker.location.state()}`,
        destination: `${faker.location.city()}, ${faker.location.state()}`,
        cargo_description: 'Ganado vacuno',
        cargo_weight: Math.floor(Math.random() * 50) + 10, // 10-60 cabezas
        status: 'completed',
        start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Hace 1 día
        end_time: new Date().toISOString(),
        distance: 0, // Se actualizará después
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    console.log(`Viaje de prueba creado con ID: ${trip.id}`);
    return trip.id;
    
  } catch (error) {
    console.error('Error al crear viaje de prueba:', error);
    return null;
  }
}

// Ejecutar el script
async function main() {
  const tripId = process.argv[2];
  
  if (!tripId) {
    console.log('No se proporcionó un ID de viaje. Creando un viaje de prueba...');
    const newTripId = await createTestTrip();
    if (newTripId) {
      await simulateTrip(newTripId);
    }
  } else {
    await simulateTrip(tripId);
  }
  
  console.log('Simulación completada');
  process.exit(0);
}

main().catch(console.error);
