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
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Probando conexión a Supabase ===');
console.log('URL:', supabaseUrl);
console.log('Clave anónima:', supabaseKey ? '***' + supabaseKey.slice(-4) : 'No definida');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para probar la conexión
async function testConnection() {
  try {
    console.log('\n=== Probando conexión a Supabase ===');
    
    // 1. Probar una consulta simple
    console.log('\n1. Probando consulta simple...');
    const { data: testData, error: testError } = await supabase
      .from('trips')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('  ❌ Error en la consulta de prueba:', testError);
    } else {
      console.log('  ✅ Conexión exitosa a Supabase');
      console.log('  Datos de prueba:', testData);
    }
    
    // 2. Verificar si la tabla 'trips' existe
    console.log('\n2. Verificando tabla trips...');
    try {
      const { data: tables, error: tablesError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
      
      if (tablesError) {
        console.error('  ❌ Error al verificar tablas:', tablesError);
      } else if (tables && tables.some((t: any) => t.tablename === 'trips')) {
        console.log('  ✅ Tabla trips encontrada');
      } else {
        console.log('  ❌ La tabla trips NO existe en la base de datos');
      }
    } catch (err) {
      console.error('  ❌ Error al verificar la tabla trips:', err);
    }
    
    // 3. Verificar si la tabla 'route_points' existe
    console.log('\n3. Verificando tabla route_points...');
    try {
      const { data: routePoints, error: routeError } = await supabase
        .from('route_points')
        .select('*')
        .limit(1);
      
      if (routeError) {
        console.error('  ❌ Error al acceder a route_points:', routeError);
      } else {
        console.log('  ✅ Tabla route_points accesible');
      }
    } catch (err) {
      console.error('  ❌ Error al verificar la tabla route_points:', err);
    }
    
  } catch (error) {
    console.error('Error en la prueba de conexión:', error);
  }
}

// Ejecutar la prueba
testConnection().then(() => {
  console.log('\n=== Prueba completada ===');
  process.exit(0);
});
