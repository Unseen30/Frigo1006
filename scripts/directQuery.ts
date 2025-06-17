import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fetch from 'node-fetch';

// Configuración para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env') });

// Configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

// URL de la API de Supabase para la tabla trips
const tripsUrl = `${supabaseUrl}/rest/v1/trips?select=*&limit=1`;

// URL para verificar los puntos de ruta de un viaje específico
const tripId = '30cb128b-e7bf-42ab-9534-1b743ff02726'; // ID del viaje que encontramos
const routePointsUrl = `${supabaseUrl}/rest/v1/route_points?trip_id=eq.${tripId}&select=*`;

// Función para hacer una consulta directa a la API de Supabase
async function querySupabase() {
  try {
    console.log('=== Consulta directa a Supabase ===');
    console.log('URL:', tripsUrl);
    
    const response = await fetch(tripsUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('\n=== Respuesta HTTP ===');
    console.log('Estado:', response.status, response.statusText);
    
    const data = await response.text();
    console.log('\n=== Datos de la respuesta ===');
    try {
      // Intentar analizar como JSON
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      // Si no es JSON válido, mostrar como texto
      console.log(data);
    }
    
  } catch (error) {
    console.error('Error en la consulta directa:', error);
  }
}

// Función para consultar los puntos de ruta
async function queryRoutePoints() {
  try {
    console.log('\n=== Consultando puntos de ruta ===');
    console.log('URL:', routePointsUrl);
    
    const response = await fetch(routePointsUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('\n=== Respuesta HTTP ===');
    console.log('Estado:', response.status, response.statusText);
    
    const data = await response.text();
    console.log('\n=== Puntos de ruta ===');
    try {
      const jsonData = JSON.parse(data);
      console.log(`Se encontraron ${jsonData.length} puntos de ruta`);
      
      if (jsonData.length > 0) {
        console.log('\nPrimer punto de ruta:');
        console.log(JSON.stringify(jsonData[0], null, 2));
        
        console.log('\nÚltimo punto de ruta:');
        console.log(JSON.stringify(jsonData[jsonData.length - 1], null, 2));
      }
    } catch (e) {
      console.log(data);
    }
    
  } catch (error) {
    console.error('Error al consultar puntos de ruta:', error);
  }
}

// Ejecutar las consultas
async function runQueries() {
  await querySupabase();
  await queryRoutePoints();
  console.log('\n=== Consulta completada ===');
  process.exit(0);
}

runQueries();
