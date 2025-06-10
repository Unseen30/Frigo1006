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

async function checkAppData() {
  try {
    console.log('=== Verificando datos de la aplicación ===');
    
    // 1. Verificar viajes recientes
    console.log('\n=== Últimos 5 viajes ===');
    const { data: recentTrips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tripsError) throw tripsError;
    
    recentTrips.forEach((trip, index) => {
      console.log(`\n--- Viaje #${index + 1} ---`);
      console.log(`ID: ${trip.id}`);
      console.log(`Origen: ${trip.origin}`);
      console.log(`Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      console.log(`Inicio: ${trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'}`);
      console.log(`Fin: ${trip.end_time ? new Date(trip.end_time).toLocaleString() : 'N/A'}`);
      
      // Verificar si tiene puntos de ruta
      checkRoutePoints(trip.id);
    });
    
    // 2. Verificar configuración de la aplicación
    console.log('\n=== Configuración de la aplicación ===');
    try {
      const { data: appConfig, error: configError } = await supabase
        .from('app_config')
        .select('*')
        .single();
      
      if (configError && configError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error al obtener configuración:', configError);
      } else if (appConfig) {
        console.log('Configuración de la aplicación:', appConfig);
      } else {
        console.log('No se encontró configuración de la aplicación');
      }
    } catch (error) {
      console.error('Error al verificar configuración:', error);
    }
    
  } catch (error) {
    console.error('Error al verificar datos de la aplicación:', error);
  }
}

async function checkRoutePoints(tripId: string) {
  try {
    const { count, error } = await supabase
      .from('route_points')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId);
    
    if (error) throw error;
    
    console.log(`Puntos de ruta: ${count}`);
    
    // Si hay puntos, mostrar algunos ejemplos
    if (count && count > 0) {
      const { data: points, error: pointsError } = await supabase
        .from('route_points')
        .select('*')
        .eq('trip_id', tripId)
        .order('timestamp', { ascending: true })
        .limit(2);
      
      if (pointsError) throw pointsError;
      
      console.log('Ejemplos de puntos:');
      points.forEach((point: any, i: number) => {
        console.log(`  ${i + 1}. ${point.latitude}, ${point.longitude} (${point.timestamp})`);
      });
      
      if (count > 2) {
        console.log(`  ... y ${count - 2} puntos más`);
      }
    }
    
  } catch (error) {
    console.error(`Error al verificar puntos para el viaje ${tripId}:`, error);
  }
}

// Ejecutar la verificación
checkAppData();
