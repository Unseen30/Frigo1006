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

async function checkDatabase() {
  try {
    console.log('=== Verificando base de datos ===');
    
    // 1. Verificar conexión a Supabase
    console.log('\n1. Probando conexión a Supabase...');
    const { data: version, error: versionError } = await supabase.rpc('version');
    if (versionError) {
      console.error('Error al conectar con Supabase:', versionError);
    } else {
      console.log('✅ Conexión exitosa a Supabase');
      console.log('Versión de Postgres:', version);
    }

    // 2. Verificar tabla de viajes
    console.log('\n2. Verificando tabla de viajes...');
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true });
    
    if (tripsError) {
      console.error('Error al acceder a la tabla de viajes:', tripsError);
    } else {
      console.log(`✅ Tabla de viajes accesible. Total de viajes: ${trips}`);
    }

    // 3. Verificar tabla de puntos de ruta
    console.log('\n3. Verificando tabla de puntos de ruta...');
    const { data: routePoints, error: pointsError } = await supabase
      .from('route_points')
      .select('*', { count: 'exact', head: true });
    
    if (pointsError) {
      console.error('Error al acceder a la tabla de puntos de ruta:', pointsError);
    } else {
      console.log(`✅ Tabla de puntos de ruta accesible. Total de puntos: ${routePoints}`);
    }

    // 4. Obtener los últimos 3 viajes
    console.log('\n4. Últimos 3 viajes:');
    const { data: recentTrips, error: recentTripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (recentTripsError) {
      console.error('Error al obtener viajes recientes:', recentTripsError);
    } else if (recentTrips && recentTrips.length > 0) {
      for (const trip of recentTrips) {
        console.log(`\n--- Viaje ID: ${trip.id} ---`);
        console.log(`Origen: ${trip.origin}`);
        console.log(`Destino: ${trip.destination}`);
        console.log(`Estado: ${trip.status}`);
        console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
        
        // Contar puntos de ruta para este viaje
        const { count: pointsCount, error: countError } = await supabase
          .from('route_points')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', trip.id);
        
        if (countError) {
          console.error('  Error al contar puntos de ruta:', countError);
        } else {
          console.log(`  Puntos de ruta: ${pointsCount}`);
        }
      }
    } else {
      console.log('No se encontraron viajes recientes.');
    }
    
  } catch (error) {
    console.error('Error al verificar la base de datos:', error);
  }
}

// Ejecutar la verificación
checkDatabase().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
}).catch(error => {
  console.error('Error en la verificación:', error);
  process.exit(1);
});
