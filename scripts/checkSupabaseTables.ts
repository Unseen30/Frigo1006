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

async function checkTables() {
  try {
    console.log('=== Verificando tablas en Supabase ===');
    
    // Intentar listar las tablas usando SQL raw
    console.log('\n1. Listando tablas...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');
    
    if (tablesError) {
      console.log('No se pudo listar tablas con RPC, intentando con consulta directa...');
      
      // Si falla, intentar con una consulta SQL directa
      const { data, error } = await supabase
        .from('pg_tables')
        .select('*')
        .eq('schemaname', 'public');
      
      if (error) {
        console.error('Error al listar tablas:', error);
      } else {
        console.log('Tablas encontradas:');
        console.log(data);
      }
    } else {
      console.log('Tablas encontradas:');
      console.log(tables);
    }
    
    // Verificar si existen las tablas necesarias
    console.log('\n2. Verificando tablas necesarias...');
    const requiredTables = ['trips', 'route_points'];
    
    for (const table of requiredTables) {
      console.log(`\nVerificando tabla: ${table}`);
      
      try {
        // Intentar hacer una consulta simple a la tabla
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.error(`  ❌ Error al acceder a la tabla ${table}:`, error.message);
        } else {
          console.log(`  ✅ Tabla ${table} accesible`);
          if (data) {
            console.log(`  Número de registros: ${data.length}`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error inesperado al verificar la tabla ${table}:`, err);
      }
    }
    
  } catch (error) {
    console.error('Error al verificar tablas:', error);
  }
}

// Función para verificar la estructura de una tabla
async function checkTableStructure(tableName: string) {
  try {
    console.log(`\n=== Verificando estructura de la tabla ${tableName} ===`);
    
    // Obtener información de las columnas
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);
    
    if (columnsError) {
      console.error(`Error al obtener columnas de ${tableName}:`, columnsError);
      return;
    }
    
    if (!columns || columns.length === 0) {
      console.log(`No se encontraron columnas para la tabla ${tableName}`);
      return;
    }
    
    console.log(`\nEstructura de ${tableName}:`);
    console.table(columns.map(col => ({
      columna: col.column_name,
      tipo: col.data_type,
      nulo: col.is_nullable === 'YES' ? 'Sí' : 'No',
      valor_predeterminado: col.column_default
    })));
    
  } catch (error) {
    console.error(`Error al verificar la estructura de ${tableName}:`, error);
  }
}

// Función principal
async function main() {
  await checkTables();
  
  // Verificar estructura de tablas específicas
  await checkTableStructure('trips');
  await checkTableStructure('route_points');
  
  console.log('\n=== Verificación completada ===');
}

// Ejecutar la verificación
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error en la verificación:', error);
  process.exit(1);
});
