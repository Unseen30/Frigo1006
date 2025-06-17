console.log('=== Verificación de configuración ===');

// Cargar variables de entorno
try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  console.log('✅ Archivo .env cargado correctamente');
} catch (error) {
  console.error('❌ Error al cargar el archivo .env:', error);
}

// Mostrar variables de entorno relevantes
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
}

console.log('\n=== Verificación completada ===');
