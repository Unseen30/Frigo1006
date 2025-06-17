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
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function listTables() {
  try {
    console.log('=== Tablas en la base de datos ===');
    
    // Obtener información de las tablas usando SQL directo
    const { data, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('*')
      .eq('schemaname', 'public');
    
    if (error) {
      console.error('Error al obtener las tablas:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No se encontraron tablas en el esquema público.');
      return;
    }
    
    console.log('\nTablas encontradas:');
    data.forEach((table: any) => {
      console.log(`- ${table.tablename}`);
    });
    
    // Para cada tabla, obtener información de columnas
    for (const table of data) {
      const tableName = table.tablename;
      console.log(`\n=== Estructura de la tabla ${tableName} ===`);
      
      try {
        // Usar SQL directo para obtener información de columnas
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns')
          .select('*')
          .eq('table_schema', 'public')
          .eq('table_name', tableName);
        
        if (colError) {
          console.error(`  Error al obtener columnas de ${tableName}:`, colError);
          continue;
        }
        
        if (!columns || columns.length === 0) {
          console.log(`  La tabla ${tableName} no tiene columnas o no se pudo acceder.`);
          continue;
        }
        
        console.log('  Columnas:');
        (columns as Array<{column_name: string, data_type: string, is_nullable: string}>).forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
      } catch (err) {
        console.error(`  Error al procesar la tabla ${tableName}:`, err);
      }
    }
    
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
listTables().then(() => {
  console.log('\n=== Análisis completado ===');
  process.exit(0);
});
