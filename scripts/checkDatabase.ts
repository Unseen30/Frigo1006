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
    console.log('=== Verificando estructura de la base de datos ===');
    
    // 1. Verificar tablas existentes
    const { data: tables, error: tablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tablesError) {
      console.error('Error al obtener tablas:', tablesError);
    } else {
      console.log('\n=== Tablas en la base de datos ===');
      console.log(tables.map((t: any) => t.tablename).join(', '));
    }
    
    // 2. Verificar estructura de la tabla trips
    console.log('\n=== Estructura de la tabla trips ===');
    try {
      const { data: tripsColumns, error: tripsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'trips');
      
      if (tripsError) throw tripsError;
      
      console.log('Columnas en la tabla trips:');
      tripsColumns.forEach((col: any) => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
      
      // Verificar si hay viajes en la tabla
      const { count: tripsCount } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\nTotal de viajes: ${tripsCount}`);
      
    } catch (error) {
      console.error('Error al verificar la tabla trips:', error);
    }
    
    // 3. Verificar estructura de la tabla route_points
    console.log('\n=== Estructura de la tabla route_points ===');
    try {
      const { data: pointsColumns, error: pointsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'route_points');
      
      if (pointsError) throw pointsError;
      
      console.log('Columnas en la tabla route_points:');
      pointsColumns.forEach((col: any) => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
      
      // Verificar si hay puntos de ruta
      const { count: pointsCount } = await supabase
        .from('route_points')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\nTotal de puntos de ruta: ${pointsCount}`);
      
      // Contar puntos por viaje
      const { data: pointsPerTrip, error: pointsPerTripError } = await supabase
        .from('route_points')
        .select('trip_id, count', { count: 'exact' })
        .select();
      
      if (pointsPerTripError) throw pointsPerTripError;
      
      // Agrupar manualmente los resultados
      const groupedPoints = pointsPerTrip.reduce((acc: Record<string, number>, point: any) => {
        const tripId = point.trip_id;
        acc[tripId] = (acc[tripId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\nPuntos de ruta por viaje:');
      pointsPerTrip.forEach((trip: any) => {
        console.log(`- Viaje ${trip.trip_id}: ${trip.count} puntos`);
      });
      
    } catch (error) {
      console.error('Error al verificar la tabla route_points:', error);
    }
    
  } catch (error) {
    console.error('Error al verificar la base de datos:', error);
  }
}

// Ejecutar la función principal
checkDatabase();
