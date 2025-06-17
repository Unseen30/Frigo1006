import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

// Configuración de Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function verifyTrips() {
  try {
    console.log('=== Verificando viajes recientes ===');
    
    // 1. Obtener los últimos 5 viajes
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tripsError) {
      console.error('Error al obtener viajes:', tripsError);
      return;
    }
    
    if (!trips || trips.length === 0) {
      console.log('No se encontraron viajes.');
      return;
    }
    
    console.log(`\nSe encontraron ${trips.length} viajes recientes:`);
    
    // 2. Para cada viaje, obtener los puntos de ruta
    for (const trip of trips) {
      console.log(`\n--- Viaje ID: ${trip.id} ---`);
      console.log(`Origen: ${trip.origin || 'N/A'}`);
      console.log(`Destino: ${trip.destination || 'N/A'}`);
      console.log(`Estado: ${trip.status || 'N/A'}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      
      // Obtener puntos de ruta
      const { count, error: countError } = await supabase
        .from('route_points')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', trip.id);
      
      if (countError) {
        console.log('  Error al contar puntos de ruta:', countError.message);
      } else {
        console.log(`  Puntos de ruta: ${count}`);
      }
    }
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la verificación
verifyTrips().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
});
