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

async function fixRecentTrips() {
  try {
    console.log('=== Actualizando viajes recientes ===');
    
    // Obtener los últimos 5 viajes
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (tripsError || !trips || trips.length === 0) {
      console.error('Error al obtener viajes:', tripsError?.message || 'No se encontraron viajes');
      return;
    }
    
    console.log(`Se encontraron ${trips.length} viajes para actualizar`);
    
    // Actualizar cada viaje
    for (const trip of trips) {
      try {
        const updates = {
          // Asegurarse de que los campos requeridos estén presentes
          status: 'completed',
          // Agregar campos que podrían faltar
          driver_id: trip.driver_id || 'default-driver-id',
          truck_id: trip.truck_id || 'default-truck-id',
          cargo_description: trip.cargo_description || 'Carga general',
          cargo_weight: trip.cargo_weight || 1000,
          distance: trip.distance || 100,
          // Asegurar que las fechas sean válidas
          start_time: trip.start_time || new Date().toISOString(),
          end_time: trip.end_time || new Date(Date.now() + 3600000).toISOString()
        };
        
        const { error: updateError } = await supabase
          .from('trips')
          .update(updates)
          .eq('id', trip.id);
        
        if (updateError) {
          console.error(`Error al actualizar viaje ${trip.id}:`, updateError.message);
        } else {
          console.log(`✅ Viaje actualizado: ${trip.origin} → ${trip.destination} (${trip.id})`);
        }
      } catch (error) {
        console.error(`Error procesando viaje ${trip.id}:`, error);
      }
    }
    
    console.log('\n=== Proceso de actualización completado ===');
    
  } catch (error) {
    console.error('Error en fixRecentTrips:', error);
  }
}

// Ejecutar la función principal
fixRecentTrips();
