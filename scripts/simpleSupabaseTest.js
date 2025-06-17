// @ts-nocheck
// Este script usa CommonJS para mayor compatibilidad

// Cargar variables de entorno
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Prueba simple de Supabase ===');
console.log('URL:', supabaseUrl);
console.log('Clave anónima:', supabaseKey ? '***' + supabaseKey.slice(-4) : 'No definida');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

// Crear cliente de Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para listar viajes
async function listTrips() {
  console.log('\nListando los últimos 5 viajes...');
  
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error al obtener viajes:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No se encontraron viajes.');
      return;
    }
    
    console.log(`\nSe encontraron ${data.length} viajes:`);
    data.forEach((trip, index) => {
      console.log(`\n--- Viaje #${index + 1} ---`);
      console.log(`ID: ${trip.id}`);
      console.log(`Origen: ${trip.origin || 'N/A'}`);
      console.log(`Destino: ${trip.destination || 'N/A'}`);
      console.log(`Estado: ${trip.status || 'N/A'}`);
      console.log(`Distancia: ${trip.distance || 0} km`);
      console.log(`Creado: ${new Date(trip.created_at).toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
listTrips().then(() => {
  console.log('\n=== Prueba completada ===');  
  process.exit(0);
});
