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
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTripCreation() {
  try {
    console.log('=== Prueba de creación de viaje ===');
    
    // 1. Crear un viaje de prueba
    const testTrip = {
      id: `test-${uuidv4()}`,
      driver_id: 'test-driver',
      vehicle_id: 'test-vehicle',
      origin: 'Montevideo',
      destination: 'Punta del Este',
      status: 'active',
      start_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cargo_description: 'Paquete de prueba',
      cargo_weight: 10
    };
    
    console.log('\n1. Creando viaje de prueba...');
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .insert([testTrip])
      .select();
    
    if (tripError) {
      console.error('  ❌ Error al crear el viaje:', tripError);
      return;
    }
    
    console.log('  ✅ Viaje creado exitosamente');
    console.log('  ID del viaje:', testTrip.id);
    
    // 2. Agregar puntos de ruta de prueba
    console.log('\n2. Agregando puntos de ruta de prueba...');
    
    const routePoints = [
      {
        trip_id: testTrip.id,
        latitude: -34.9011,
        longitude: -56.1645,
        timestamp: new Date().toISOString(),
        accuracy: 10,
        speed: 0,
        heading: 0
      },
      {
        trip_id: testTrip.id,
        latitude: -34.9100,
        longitude: -56.1700,
        timestamp: new Date(Date.now() + 60000).toISOString(),
        accuracy: 10,
        speed: 10,
        heading: 90
      }
    ];
    
    const { error: pointsError } = await supabase
      .from('route_points')
      .insert(routePoints);
    
    if (pointsError) {
      console.error('  ❌ Error al agregar puntos de ruta:', pointsError);
      return;
    }
    
    console.log('  ✅ Puntos de ruta agregados exitosamente');
    
    // 3. Verificar que los datos se hayan guardado
    console.log('\n3. Verificando los datos guardados...');
    
    const { data: savedTrip, error: fetchError } = await supabase
      .from('trips')
      .select('*, route_points(*)')
      .eq('id', testTrip.id)
      .single();
    
    if (fetchError) {
      console.error('  ❌ Error al recuperar el viaje:', fetchError);
      return;
    }
    
    console.log('  ✅ Viaje recuperado exitosamente');
    console.log('  Detalles del viaje:', {
      id: savedTrip.id,
      origin: savedTrip.origin,
      destination: savedTrip.destination,
      status: savedTrip.status,
      route_points_count: savedTrip.route_points?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Ejecutar la prueba
testTripCreation().then(() => {
  console.log('\n=== Prueba completada ===');
  process.exit(0);
});
