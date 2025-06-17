import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTripsWithRoutes() {
  try {
    console.log('Buscando viajes con rutas...');
    
    // 1. Obtener los últimos 5 viajes
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tripsError) throw tripsError;
    
    console.log(`\n=== Se encontraron ${trips.length} viajes ===`);
    
    for (const trip of trips) {
      console.log(`\n--- Viaje ID: ${trip.id} ---`);
      console.log(`Origen: ${trip.origin}`);
      console.log(`Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      
      // 2. Obtener puntos de ruta para este viaje
      console.log('\nObteniendo puntos de ruta...');
      const { data: routePoints, error: pointsError } = await supabase
        .from('route_points')
        .select('*')
        .eq('trip_id', trip.id)
        .order('timestamp', { ascending: true });
      
      if (pointsError) {
        console.error('  Error al obtener puntos de ruta:', pointsError);
        continue;
      }
      
      console.log(`  Puntos de ruta encontrados: ${routePoints.length}`);
      
      // Mostrar primeros 3 puntos
      if (routePoints.length > 0) {
        console.log('\n  Primeros 3 puntos:');
        routePoints.slice(0, 3).forEach((point, i) => {
          console.log(`  ${i + 1}. Lat: ${point.latitude}, Lng: ${point.longitude} (${new Date(point.timestamp).toLocaleTimeString()})`);
        });
      }
      
      // Mostrar últimos 3 puntos si hay más de 6
      if (routePoints.length > 6) {
        console.log('  ...');
        routePoints.slice(-3).forEach((point, i) => {
          const idx = routePoints.length - 3 + i;
          console.log(`  ${idx + 1}. Lat: ${point.latitude}, Lng: ${point.longitude} (${new Date(point.timestamp).toLocaleTimeString()})`);
        });
      } else if (routePoints.length > 3) {
        routePoints.slice(3).forEach((point, i) => {
          console.log(`  ${i + 4}. Lat: ${point.latitude}, Lng: ${point.longitude} (${new Date(point.timestamp).toLocaleTimeString()})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error al verificar viajes con rutas:', error);
  }
}

// Ejecutar la verificación
checkTripsWithRoutes().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
}).catch(error => {
  console.error('Error en la verificación:', error);
  process.exit(1);
});
