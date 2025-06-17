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

async function checkTrips() {
  try {
    console.log('Buscando viajes recientes...');
    
    // Obtener los últimos 5 viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    console.log(`\n=== Se encontraron ${trips.length} viajes recientes ===`);
    
    for (const trip of trips) {
      console.log(`\n--- Viaje ID: ${trip.id} ---`);
      console.log(`Origen: ${trip.origin}`);
      console.log(`Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      
      // Verificar puntos de ruta
      const { count: pointsCount, error: pointsError } = await supabase
        .from('route_points')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', trip.id);
      
      if (pointsError) throw pointsError;
      
      console.log(`Puntos de ruta: ${pointsCount}`);
      
      // Mostrar algunos puntos de ruta como ejemplo
      if (pointsCount && pointsCount > 0) {
        const { data: points, error: pointsDataError } = await supabase
          .from('route_points')
          .select('latitude, longitude, timestamp')
          .eq('trip_id', trip.id)
          .order('timestamp', { ascending: true })
          .limit(2);
        
        if (pointsDataError) throw pointsDataError;
        
        console.log('Primeros puntos de ruta:');
        points.forEach((point, i) => {
          console.log(`  ${i + 1}. Lat: ${point.latitude}, Lng: ${point.longitude} (${new Date(point.timestamp).toLocaleTimeString()})`);
        });
      }
    }
  } catch (error) {
    console.error('Error al verificar viajes:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal
checkTrips();
