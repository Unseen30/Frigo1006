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
  console.log('Asegúrate de tener un archivo .env con:');
  console.log('VITE_SUPABASE_URL=tu_url_de_supabase');
  console.log('VITE_SUPABASE_ANON_KEY=tu_clave_anonima');
  process.exit(1);
}

console.log('Conectando a Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
  try {
    console.log('\n=== Probando conexión a Supabase ===');
    
    // 1. Probar una consulta simple a la tabla 'trips'
    console.log('\n1. Probando consulta a la tabla trips...');
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .limit(1);
    
    if (tripsError) {
      console.error('Error al consultar la tabla trips:', tripsError);
    } else {
      console.log('✅ Conexión exitosa a la tabla trips');
      console.log(`Número de viajes encontrados: ${trips?.length || 0}`);
    }
    
    // 2. Probar una consulta a la tabla 'route_points'
    console.log('\n2. Probando consulta a la tabla route_points...');
    const { data: routePoints, error: pointsError } = await supabase
      .from('route_points')
      .select('*')
      .limit(1);
    
    if (pointsError) {
      console.error('Error al consultar la tabla route_points:', pointsError);
    } else {
      console.log('✅ Conexión exitosa a la tabla route_points');
      console.log(`Número de puntos de ruta encontrados: ${routePoints?.length || 0}`);
    }
    
    // 3. Obtener los últimos 3 viajes con conteo de puntos
    console.log('\n3. Obteniendo los últimos 3 viajes...');
    const { data: recentTrips, error: recentTripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (recentTripsError) {
      console.error('Error al obtener viajes recientes:', recentTripsError);
    } else if (recentTrips && recentTrips.length > 0) {
      console.log(`\n=== Últimos ${recentTrips.length} viajes ===`);
      
      for (const trip of recentTrips) {
        console.log(`\n--- Viaje ID: ${trip.id} ---`);
        console.log(`Origen: ${trip.origin}`);
        console.log(`Destino: ${trip.destination}`);
        console.log(`Estado: ${trip.status}`);
        console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
        
        // Contar puntos de ruta para este viaje
        const { count, error: countError } = await supabase
          .from('route_points')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', trip.id);
        
        if (countError) {
          console.log('  Error al contar puntos de ruta:', countError);
        } else {
          console.log(`  Puntos de ruta: ${count}`);
        }
      }
    } else {
      console.log('No se encontraron viajes recientes.');
    }
    
  } catch (error) {
    console.error('Error al verificar la conexión:', error);
  }
}

// Ejecutar la verificación
checkConnection().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
});
