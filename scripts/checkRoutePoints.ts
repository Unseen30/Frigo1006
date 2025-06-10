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

async function checkRoutePoints(tripId: string) {
  try {
    console.log(`=== Verificando puntos de ruta para el viaje ${tripId} ===`);
    
    // Obtener información del viaje
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();
    
    if (tripError || !trip) {
      console.error('Error al obtener el viaje:', tripError?.message || 'Viaje no encontrado');
      return;
    }
    
    console.log(`Viaje: ${trip.origin} → ${trip.destination}`);
    console.log(`Estado: ${trip.status}`);
    console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
    
    // Verificar si hay puntos de ruta
    const { data: points, error: pointsError } = await supabase
      .from('route_points')
      .select('*')
      .eq('trip_id', tripId)
      .order('timestamp', { ascending: true });
    
    if (pointsError) {
      console.error('Error al obtener puntos de ruta:', pointsError.message);
      return;
    }
    
    console.log(`\nSe encontraron ${points.length} puntos de ruta`);
    
    if (points.length > 0) {
      console.log('\nPrimer punto:');
      console.log(`- Lat: ${points[0].latitude}, Lng: ${points[0].longitude}`);
      console.log(`- Timestamp: ${points[0].timestamp}`);
      
      console.log('\nÚltimo punto:');
      console.log(`- Lat: ${points[points.length-1].latitude}, Lng: ${points[points.length-1].longitude}`);
      console.log(`- Timestamp: ${points[points.length-1].timestamp}`);
    }
    
  } catch (error) {
    console.error('Error al verificar puntos de ruta:', error);
  }
}

// Ejecutar la función principal con el ID del viaje más reciente
checkRoutePoints('3685ab57-6dd0-4d98-ace7-a3a4e84a16c0');
