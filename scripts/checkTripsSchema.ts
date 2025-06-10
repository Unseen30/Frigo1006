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

async function checkTripsTable() {
  try {
    // Obtener información de la tabla trips
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, udt_name')
      .eq('table_name', 'trips');
    
    if (error) {
      console.error('Error al obtener la información de la tabla trips:', error);
      return;
    }
    
    console.log('Estructura actual de la tabla trips:');
    console.table(columns);
    
    // Verificar si existen las columnas de coordenadas
    const hasOriginCoords = columns.some(col => col.column_name === 'origin_coords');
    const hasDestCoords = columns.some(col => col.column_name === 'destination_coords');
    
    console.log('\nEstado de las columnas de coordenadas:');
    console.log(`- origin_coords: ${hasOriginCoords ? '✅ Existe' : '❌ No existe'}`);
    console.log(`- destination_coords: ${hasDestCoords ? '✅ Existe' : '❌ No existe'}`);
    
    if (!hasOriginCoords || !hasDestCoords) {
      console.log('\nPara agregar las columnas faltantes, ejecuta el siguiente comando SQL en la consola de Supabase:');
      console.log(`
  ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS origin_coords geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS destination_coords geometry(Point, 4326);
  `);
    }
    
  } catch (error) {
    console.error('Error al verificar la tabla trips:', error);
  }
}

checkTripsTable();
