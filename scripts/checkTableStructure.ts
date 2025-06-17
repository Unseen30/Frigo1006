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

async function checkTableStructure() {
  try {
    console.log('=== Verificando estructura de la base de datos ===');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Faltan las variables de entorno de Supabase.');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verificar si la tabla trips existe
    console.log('\n1. Verificando tabla trips...');
    try {
      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('  ❌ Error al acceder a la tabla trips:', error);
      } else {
        console.log('  ✅ Tabla trips accesible');
        if (trips && trips.length > 0) {
          console.log('  Muestra de un viaje:', JSON.stringify(trips[0], null, 2));
        } else {
          console.log('  No hay viajes en la tabla trips');
        }
      }
    } catch (err) {
      console.error('  ❌ Error inesperado al acceder a trips:', err);
    }
    
    // Verificar si la tabla route_points existe
    console.log('\n2. Verificando tabla route_points...');
    try {
      const { data: routePoints, error } = await supabase
        .from('route_points')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('  ❌ Error al acceder a la tabla route_points:', error);
      } else {
        console.log('  ✅ Tabla route_points accesible');
        if (routePoints && routePoints.length > 0) {
          console.log('  Muestra de un punto de ruta:', JSON.stringify(routePoints[0], null, 2));
        } else {
          console.log('  No hay puntos de ruta en la tabla route_points');
        }
      }
    } catch (err) {
      console.error('  ❌ Error inesperado al acceder a route_points:', err);
    }
    
    // Verificar la relación entre las tablas
    console.log('\n3. Verificando relación entre tablas...');
    try {
      const { data: tripsWithPoints, error } = await supabase
        .from('trips')
        .select(`
          *,
          route_points (
            id,
            latitude,
            longitude,
            timestamp
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('  ❌ Error al consultar viajes con puntos de ruta:', error);
      } else if (tripsWithPoints && tripsWithPoints.length > 0) {
        const trip = tripsWithPoints[0] as any;
        console.log(`  Viaje ID: ${trip.id}`);
        console.log(`  Puntos de ruta: ${trip.route_points?.length || 0}`);
        
        if (trip.route_points && trip.route_points.length > 0) {
          console.log('  Primer punto de ruta:', {
            id: trip.route_points[0].id,
            latitude: trip.route_points[0].latitude,
            longitude: trip.route_points[0].longitude,
            timestamp: trip.route_points[0].timestamp
          });
        }
      } else {
        console.log('  No se encontraron viajes con puntos de ruta');
      }
    } catch (err) {
      console.error('  ❌ Error al verificar la relación entre tablas:', err);
    }
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la verificación
checkTableStructure().then(() => {
  console.log('\n=== Verificación completada ===');
  process.exit(0);
});
