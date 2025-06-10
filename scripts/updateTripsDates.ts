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

async function updateTripsDates() {
  try {
    console.log('Actualizando fechas de los viajes...');
    
    // Obtener los últimos 4 viajes completados (los que acabamos de crear)
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4);
    
    if (error) throw error;
    
    console.log(`Actualizando ${trips.length} viajes...`);
    
    // Actualizar cada viaje con fechas recientes
    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const now = new Date();
      const startTime = new Date(now);
      const endTime = new Date(now);
      
      // Hacer que los viajes terminen en el pasado reciente (últimas 24 horas)
      startTime.setHours(now.getHours() - (24 - i * 6)); // 24, 18, 12, 6 horas atrás
      endTime.setHours(startTime.getHours() + 2); // 2 horas de duración
      
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          created_at: startTime.toISOString()
        })
        .eq('id', trip.id);
      
      if (updateError) {
        console.error(`Error al actualizar viaje ${trip.id}:`, updateError);
      } else {
        console.log(`✅ Viaje actualizado: ${trip.origin} → ${trip.destination} (${startTime.toLocaleString()} - ${endTime.toLocaleString()})`);
      }
    }
    
    console.log('\n¡Actualización completada! Los viajes ahora deberían aparecer en el historial reciente.');
    
  } catch (error) {
    console.error('Error al actualizar fechas de viajes:', error);
  }
}

// Ejecutar la función principal
updateTripsDates();
