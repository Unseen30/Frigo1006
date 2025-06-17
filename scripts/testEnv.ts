// Cargar variables de entorno
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar el archivo .env
const envPath = resolve(__dirname, '../.env');
const result = config({ path: envPath });

if (result.error) {
  console.error('Error al cargar el archivo .env:', result.error);
} else {
  console.log('Archivo .env cargado correctamente');
}

// Mostrar las variables de entorno relevantes
console.log('\n=== Variables de entorno ===');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '*** Configurado ***' : 'No configurado');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '*** Clave configurada ***' : 'No configurado');
console.log('VITE_ORS_API_KEY:', process.env.VITE_ORS_API_KEY ? '*** Clave configurada ***' : 'No configurado');

// Verificar si las variables necesarias están configuradas
const configOk = process.env.VITE_SUPABASE_URL && 
                process.env.VITE_SUPABASE_ANON_KEY && 
                process.env.VITE_ORS_API_KEY;

if (configOk) {
  console.log('\n✅ Configuración básica correcta');
} else {
  console.log('\n❌ Faltan variables de configuración necesarias');
  
  // Mostrar el directorio donde se está buscando el archivo .env
  console.log('\nBuscando archivo .env en:', envPath);
  
  // Verificar si el archivo .env existe
  try {
    const fs = await import('fs');
    const exists = fs.existsSync(envPath);
    console.log('El archivo .env', exists ? 'existe' : 'NO existe');
    
    if (exists) {
      console.log('Contenido del archivo .env:');
      const content = fs.readFileSync(envPath, 'utf8');
      // Mostrar el contenido pero ocultando valores sensibles
      const maskedContent = content
        .split('\n')
        .map(line => {
          if (line.includes('KEY') || line.includes('SECRET') || line.includes('PASSWORD')) {
            return line.split('=')[0] + '=***';
          }
          return line;
        })
        .join('\n');
      console.log(maskedContent);
    }
  } catch (err) {
    console.error('Error al verificar el archivo .env:', err);
  }
}

console.log('\n=== Verificación completada ===');
