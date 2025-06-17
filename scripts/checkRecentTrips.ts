import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkRecentTrips() {
  try {
    // Obtener los últimos 5 viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:drivers(name, email),
        truck:trucks(plate_number)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    console.log('\n=== ÚLTIMOS VIAJES ===');
    trips?.forEach((trip: any) => {
      console.log('\n---');
      console.log(`ID: ${trip.id}`);
      console.log(`Ruta: ${trip.origin} → ${trip.destination}`);
      console.log(`Conductor: ${trip.driver?.name} (${trip.driver?.email})`);
      console.log(`Camión: ${trip.truck?.plate_number || 'N/A'}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Distancia: ${trip.distance || 0} km`);
      console.log(`Inicio: ${new Date(trip.start_time).toLocaleString()}`);
      console.log(`Fin: ${trip.end_time ? new Date(trip.end_time).toLocaleString() : 'En progreso'}`);
      
      // Verificar puntos de ruta
      checkRoutePoints(trip.id);
    });

  } catch (error) {
    console.error('Error al verificar viajes:', error);
  }
}

async function checkRoutePoints(tripId: string) {
  try {
    const { count, error: countError } = await supabase
      .from('route_points')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId);

    if (countError) throw countError;

    console.log(`Puntos de ruta: ${count || 0}`);

    // Mostrar algunos puntos de ejemplo
    if (count && count > 0) {
      const { data: points, error: pointsError } = await supabase
        .from('route_points')
        .select('*')
        .eq('trip_id', tripId)
        .order('timestamp', { ascending: true })
        .limit(2);

      if (pointsError) throw pointsError;

      console.log('Primeros puntos:');
      points?.forEach((point: any, i: number) => {
        console.log(`  ${i + 1}. [${point.latitude}, ${point.longitude}] - ${new Date(point.timestamp).toLocaleTimeString()}`);
      });

      if (count > 2) {
        console.log(`  ... y ${count - 2} puntos más`);
      }
    }
  } catch (error) {
    console.error('Error al verificar puntos de ruta:', error);
  }
}

// Ejecutar la verificación
checkRecentTrips().then(() => {
  console.log('\nVerificación completada');  
  process.exit(0);
}).catch(console.error);
