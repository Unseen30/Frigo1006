import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

// Configuración de Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function createTestTrip() {
  try {
    console.log('Creando un viaje de prueba...');
    
    // Crear un ID único para el viaje
    const tripId = `test-${uuidv4()}`;
    const now = new Date();
    
    // Insertar el viaje en la base de datos
    const { data, error } = await supabase
      .from('trips')
      .insert([{
        id: tripId,
        driver_id: 'test-driver',
        vehicle_id: 'test-vehicle',
        status: 'active',
        start_time: now.toISOString(),
        origin: 'Origen de prueba',
        destination: 'Destino de prueba',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }])
      .select();
    
    if (error) {
      console.error('Error al crear el viaje de prueba:', error);
      return null;
    }
    
    console.log(`✅ Viaje de prueba creado con ID: ${tripId}`);
    return tripId;
    
  } catch (error) {
    console.error('Error inesperado al crear viaje de prueba:', error);
    return null;
  }
}

// Ejecutar la creación y simulación
async function main() {
  // 1. Crear un viaje de prueba
  const tripId = await createTestTrip();
  
  if (!tripId) {
    console.error('No se pudo crear el viaje de prueba');
    process.exit(1);
  }
  
  console.log('\n=== Iniciando simulación de viaje ===');
  
  // 2. Importar y ejecutar la simulación
  try {
    // Importar dinámicamente el módulo de simulación
    const { simulateTrip } = await import('./simulateTrip.js');
    await simulateTrip(tripId);
    
    console.log('\n=== Simulación completada exitosamente ===');
    console.log(`ID del viaje simulado: ${tripId}`);
    
  } catch (error) {
    console.error('Error durante la simulación:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main().then(() => {
  process.exit(0);
});
