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

async function listTrips() {
  try {
    console.log('Obteniendo lista de viajes...');
    
    // Obtener todos los viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`\n=== Se encontraron ${trips.length} viajes ===`);
    
    trips.forEach((trip, index) => {
      console.log(`\n--- Viaje #${index + 1} ---`);
      console.log(`ID: ${trip.id}`);
      console.log(`Origen: ${trip.origin}`);
      console.log(`Destino: ${trip.destination}`);
      console.log(`Estado: ${trip.status}`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
      console.log(`Inicio: ${trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'}`);
      console.log(`Fin: ${trip.end_time ? new Date(trip.end_time).toLocaleString() : 'N/A'}`);
      
      // Contar puntos de ruta
      countRoutePoints(trip.id);
    });
    
  } catch (error) {
    console.error('Error al listar viajes:', error);
  }
}

async function countRoutePoints(tripId: string) {
  try {
    const { count, error } = await supabase
      .from('route_points')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId);
    
    if (error) throw error;
    
    console.log(`Puntos de ruta: ${count}`);
  } catch (error) {
    console.error(`Error al contar puntos para el viaje ${tripId}:`, error);
  }
}

// Ejecutar la función principal
listTrips();
