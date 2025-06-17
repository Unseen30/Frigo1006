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

async function listTrips() {
  try {
    console.log('=== Listando viajes ===');
    
    // Obtener los últimos 5 viajes
    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error al obtener viajes:', error);
      return;
    }
    
    if (!trips || trips.length === 0) {
      console.log('No se encontraron viajes.');
      return;
    }
    
    console.log(`\nSe encontraron ${trips.length} viajes:`);
    console.log(JSON.stringify(trips, null, 2));
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
listTrips().then(() => {
  console.log('\n=== Fin del listado ===');
  process.exit(0);
});
