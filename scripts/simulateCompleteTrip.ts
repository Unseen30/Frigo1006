import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
config({ path: resolve(__dirname, '../.env') });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const orsApiKey = process.env.VITE_ORS_API_KEY;

if (!supabaseUrl || !supabaseKey || !orsApiKey) {
  console.error('Error: Faltan variables de entorno necesarias.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Coordenadas de ejemplo en Uruguay (Montevideo a Punta del Este)
const START_POINT = [-56.1645, -34.9011]; // [longitud, latitud]
const END_POINT = [-54.95, -34.9667];     // [longitud, latitud]

/**
 * Obtiene una ruta de OpenRouteService
 */
async function getRoute() {
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsApiKey}&start=${START_POINT[0]},${START_POINT[1]}&end=${END_POINT[0]},${END_POINT[1]}`;
    
    console.log('Obteniendo ruta de OpenRouteService...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, application/geo+json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en la respuesta de OpenRouteService: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No se encontró ninguna ruta en la respuesta de OpenRouteService');
    }
    
    const route = data.features[0];
    const distance = route.properties.summary.distance; // en metros
    const duration = route.properties.summary.duration; // en segundos
    const coordinates = route.geometry.coordinates; // array de [longitud, latitud]
    
    console.log(`Ruta obtenida: ${(distance / 1000).toFixed(2)} km, ${Math.round(duration / 60)} minutos, ${coordinates.length} puntos`);
    
    return {
      coordinates,
      distance,
      duration
    };
    
  } catch (error) {
    console.error('Error al obtener la ruta:', error);
    throw error;
  }
}

/**
 * Crea un nuevo viaje en Supabase
 */
async function createTrip() {
  const tripId = `test-${uuidv4()}`;
  const now = new Date().toISOString();
  
  const tripData = {
    id: tripId,
    driver_id: 'test-driver',
    vehicle_id: 'test-vehicle',
    origin: 'Montevideo (Prueba)',
    destination: 'Punta del Este (Prueba)',
    status: 'active',
    start_time: now,
    created_at: now,
    updated_at: now,
    cargo_description: 'Paquete de prueba',
    cargo_weight: 10,
    distance: 0 // Se actualizará después
  };
  
  console.log('\nCreando viaje de prueba en Supabase...');
  const { data, error } = await supabase
    .from('trips')
    .insert([tripData])
    .select();
  
  if (error) {
    throw new Error(`Error al crear el viaje: ${error.message}`);
  }
  
  console.log(`✅ Viaje creado con ID: ${tripId}`);
  return tripId;
}

/**
 * Inserta los puntos de ruta en Supabase
 */
async function insertRoutePoints(tripId: string, coordinates: number[][]) {
  const BATCH_SIZE = 100; // Tamaño del lote para la inserción
  const routePoints = [];
  const now = new Date();
  
  console.log('\nPreparando puntos de ruta...');
  
  // Crear puntos de ruta a partir de las coordenadas
  for (let i = 0; i < coordinates.length; i++) {
    const [longitude, latitude] = coordinates[i];
    
    routePoints.push({
      trip_id: tripId,
      latitude,
      longitude,
      timestamp: new Date(now.getTime() + i * 60000).toISOString(), // 1 minuto entre puntos
      accuracy: 10 + Math.random() * 5, // Precisión simulada
      speed: 30 + Math.random() * 20, // Velocidad simulada en km/h
      heading: Math.random() * 360, // Dirección simulada en grados
      created_at: new Date().toISOString()
    });
  }
  
  console.log(`Insertando ${routePoints.length} puntos de ruta en lotes de ${BATCH_SIZE}...`);
  
  // Insertar en lotes
  for (let i = 0; i < routePoints.length; i += BATCH_SIZE) {
    const batch = routePoints.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('route_points').insert(batch);
    
    if (error) {
      throw new Error(`Error al insertar lote de puntos ${i+1}-${Math.min(i + BATCH_SIZE, routePoints.length)}: ${error.message}`);
    }
    
    console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1} insertado: ${i + 1}-${Math.min(i + BATCH_SIZE, routePoints.length)}/${routePoints.length}`);
  }
  
  console.log(`✅ ${routePoints.length} puntos de ruta insertados correctamente`);
  return routePoints.length;
}

/**
 * Actualiza el viaje con la distancia y lo marca como completado
 */
async function completeTrip(tripId: string, distance: number) {
  console.log('\nActualizando viaje con distancia y marcando como completado...');
  
  const { error } = await supabase
    .from('trips')
    .update({
      status: 'completed',
      distance: Math.round(distance / 1000), // Convertir a kilómetros
      end_time: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', tripId);
  
  if (error) {
    throw new Error(`Error al actualizar el viaje: ${error.message}`);
  }
  
  console.log('✅ Viaje actualizado y marcado como completado');
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('=== Simulación de viaje iniciada ===');
    
    // 1. Obtener ruta de OpenRouteService
    const { coordinates, distance } = await getRoute();
    
    // 2. Crear viaje en Supabase
    const tripId = await createTrip();
    
    // 3. Insertar puntos de ruta
    const pointsCount = await insertRoutePoints(tripId, coordinates);
    
    // 4. Actualizar viaje con distancia y marcarlo como completado
    await completeTrip(tripId, distance);
    
    console.log('\n=== Simulación completada con éxito ===');
    console.log(`ID del viaje: ${tripId}`);
    console.log(`Distancia: ${(distance / 1000).toFixed(2)} km`);
    console.log(`Puntos de ruta: ${pointsCount}`);
    
  } catch (error) {
    console.error('\n❌ Error en la simulación:', error);
    process.exit(1);
  }
}

// Ejecutar la simulación
main().then(() => {
  process.exit(0);
});
