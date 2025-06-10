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

async function checkSchema() {
  try {
    console.log('=== Verificando esquema de la base de datos ===');
    
    // Obtener todas las tablas
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tablesError) {
      console.error('Error al obtener tablas:', tablesError);
      return;
    }
    
    console.log('\n=== Tablas encontradas ===');
    console.log(tables.map((t: any) => t.tablename).join(', '));
    
    // Verificar estructura de la tabla trips
    await checkTableSchema('trips');
    
    // Verificar estructura de la tabla route_points
    await checkTableSchema('route_points');
    
  } catch (error) {
    console.error('Error al verificar el esquema:', error);
  }
}

async function checkTableSchema(tableName: string) {
  try {
    console.log(`\n=== Estructura de la tabla ${tableName} ===`);
    
    // Obtener las columnas de la tabla
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', tableName);
    
    if (columnsError) {
      console.error(`Error al obtener columnas de ${tableName}:`, columnsError);
      return;
    }
    
    if (!columns || columns.length === 0) {
      console.log(`La tabla ${tableName} no existe o no tiene columnas`);
      return;
    }
    
    console.log(`Columnas en ${tableName}:`);
    columns.forEach((col: any) => {
      console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Mostrar algunos registros de ejemplo
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error(`Error al obtener datos de ejemplo de ${tableName}:`, sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log(`\nEjemplo de registro en ${tableName}:`);
      console.log(JSON.stringify(sampleData[0], null, 2));
    }
    
  } catch (error) {
    console.error(`Error al verificar la tabla ${tableName}:`, error);
  }
}

// Ejecutar la verificación
checkSchema();
