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

async function checkTrips() {
  try {
    console.log('Obteniendo viajes recientes...');
    
    // Obtener los últimos 5 viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    console.log(`\n=== Últimos ${trips.length} viajes ===`);
    
    for (const trip of trips) {
      console.log(`\n--- Viaje ID: ${trip.id} ---`);
      console.log(`Origen: ${trip.origin}`);
      console.log(`Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      
      // Contar puntos de ruta
      const { count, error: countError } = await supabase
        .from('route_points')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', trip.id);
      
      if (countError) throw countError;
      console.log(`Puntos de ruta: ${count}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTrips().then(() => process.exit(0));
