import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker/locale/es';
import type { Database } from '../src/integrations/supabase/types.js';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
// @ts-ignore - __dirname no está definido en módulos ES
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  console.log('Asegúrate de tener un archivo .env con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
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
    
    // 2. Generar puntos de ruta (usamos coordenadas de ejemplo para Uruguay)
    // Coordenadas de ejemplo en Uruguay
    const startPoint = {
      lat: -34.9011 + (Math.random() * 0.5 - 0.25), // Montevideo ±0.25 grados
      lng: -56.1645 + (Math.random() * 0.5 - 0.25)
    };
    
    const endPoint = {
      lat: startPoint.lat + (Math.random() * 0.3 - 0.15), // Hasta ~15km de distancia
      lng: startPoint.lng + (Math.random() * 0.3 - 0.15)
    };
    
    const routePoints = generateRoutePoints(
      startPoint.lat, startPoint.lng,
      endPoint.lat, endPoint.lng,
      30 // Número de puntos a generar
    );
    
    console.log(`Generados ${routePoints.length} puntos de ruta`);
    
    // 3. Insertar los puntos de ruta en la base de datos
    const timestamp = new Date(trip.start_time || new Date().toISOString());
    const pointsToInsert: Omit<RoutePointDB, 'id'>[] = routePoints.map((point, index) => ({
      trip_id: tripId,
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: new Date(timestamp.getTime() + index * 60000).toISOString() // 1 minuto entre puntos
    }));
    
    const { error: insertError } = await supabase
      .from('route_points')
      .insert(pointsToInsert);
    
    if (insertError) {
      console.error('Error al insertar puntos de ruta:', insertError);
      return;
    }
    
    console.log(`Se insertaron ${pointsToInsert.length} puntos de ruta exitosamente`);
    
    // 4. Actualizar la distancia del viaje (aproximada)
    const distanceKm = calculateDistance(
      startPoint.lat, startPoint.lng,
      endPoint.lat, endPoint.lng
    );
    
    await supabase
      .from('trips')
      .update({ distance: parseFloat(distanceKm.toFixed(2)) })
      .eq('id', tripId);
    
    console.log(`Distancia del viaje actualizada a ${distanceKm.toFixed(2)} km`);
    
  } catch (error) {
    console.error('Error en la simulación del viaje:', error);
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
