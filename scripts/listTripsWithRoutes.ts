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
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTripsWithRoutes() {
  try {
    console.log('=== Listando los últimos 5 viajes ===');
    
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
    
    // 2. Para cada viaje, verificar si tiene puntos de ruta
    for (const trip of trips) {
      console.log(`\n--- Viaje ID: ${trip.id} ---`);
      console.log(`Origen: ${trip.origin || 'N/A'}`);
      console.log(`Destino: ${trip.destination || 'N/A'}`);
      console.log(`Estado: ${trip.status || 'N/A'}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      
      // Verificar si hay puntos de ruta
      const { count, error: countError } = await supabase
        .from('route_points')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', trip.id);
      
      if (countError) {
        console.log('  Error al contar puntos de ruta:', countError.message);
      } else {
        console.log(`  Puntos de ruta: ${count}`);
        
        // Si hay puntos, mostrar algunos detalles
        if (count && count > 0) {
          const { data: points, error: pointsError } = await supabase
            .from('route_points')
            .select('*')
            .eq('trip_id', trip.id)
            .order('timestamp', { ascending: true })
            .limit(2);
          
          if (pointsError) {
            console.log('  Error al obtener puntos de ruta:', pointsError.message);
          } else if (points && points.length > 0) {
            console.log('  Primer punto de ruta:', {
              id: points[0].id,
              latitude: points[0].latitude,
              longitude: points[0].longitude,
              timestamp: new Date(points[0].timestamp).toLocaleString()
            });
            
            if (points.length > 1) {
              console.log('  Último punto de ruta:', {
                id: points[points.length - 1].id,
                latitude: points[points.length - 1].latitude,
                longitude: points[points.length - 1].longitude,
                timestamp: new Date(points[points.length - 1].timestamp).toLocaleString()
              });
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
listTripsWithRoutes().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
});
