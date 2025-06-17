// @ts-ignore - Ignorar errores de tipo para este script mínimo
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

console.log('=== Prueba mínima de conexión a Supabase ===');
console.log('URL:', supabaseUrl);
console.log('Clave anónima:', supabaseKey ? '***' + supabaseKey.slice(-4) : 'No definida');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Intentar una consulta simple
console.log('\nIntentando consultar la tabla trips...');
supabase
  .from('trips')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('Error en la consulta:', error);
    } else {
      console.log('Consulta exitosa. Datos:', data);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Error inesperado:', error);
    process.exit(1);
  });
